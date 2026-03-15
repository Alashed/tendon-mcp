import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getContainer } from '../../di/container.js';
import { config } from '../../config/index.js';
import { AppError } from '../../shared/errors/AppError.js';
import { verifyAndUpsertClerkUser } from '../../shared/clerk/clerkAuth.js';

export async function oauthRoutes(app: FastifyInstance): Promise<void> {

  // ── RFC 8414: Authorization Server Metadata ─────────────────────────────
  app.get('/.well-known/oauth-authorization-server', async (_request, reply) => {
    const base = config.apiBaseUrl;
    return reply.send({
      issuer: base,
      // Authorization happens in the web app (Clerk auth)
      authorization_endpoint: `${config.webBaseUrl}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      registration_endpoint: `${base}/oauth/register`,
      introspection_endpoint: `${base}/oauth/introspect`,
      scopes_supported: ['mcp'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    });
  });

  // ── RFC 7591: Dynamic Client Registration ────────────────────────────────
  app.post('/oauth/register', async (request, reply) => {
    const Schema = z.object({
      client_name: z.string().optional(),
      redirect_uris: z.array(z.string()).min(1),
      grant_types: z.array(z.string()).optional(),
      response_types: z.array(z.string()).optional(),
      token_endpoint_auth_method: z.string().optional(),
      scope: z.string().optional(),
    });

    const body = Schema.parse(request.body);
    const { oauthService } = getContainer();
    const client = await oauthService.registerClient(body);

    return reply.status(201).send({
      client_id: client.client_id,
      client_name: client.client_name,
      redirect_uris: client.redirect_uris,
      grant_types: client.grant_types,
      response_types: client.response_types,
      token_endpoint_auth_method: client.token_endpoint_auth_method,
    });
  });

  // ── GET /oauth/authorize ─────────────────────────────────────────────────
  // Two modes:
  //   1. WEB_BASE_URL is set and different from API → redirect to Next.js consent UI (Clerk)
  //   2. Standalone / self-hosted → serve a built-in HTML consent form (no Clerk needed)
  app.get('/oauth/authorize', async (request, reply) => {
    const params = request.query as Record<string, string>;
    const { oauthService } = getContainer();

    try {
      await oauthService.validateAuthorizeRequest(params);
    } catch (err) {
      const msg = err instanceof AppError ? err.message : 'Invalid request';
      return reply.status(400).send({ error: msg });
    }

    const isStandaloneMode =
      !config.webBaseUrl ||
      config.webBaseUrl === config.apiBaseUrl ||
      config.webBaseUrl.includes('localhost:3001');

    if (!isStandaloneMode) {
      const webUrl = new URL(`${config.webBaseUrl}/oauth/authorize`);
      Object.entries(params).forEach(([k, v]) => webUrl.searchParams.set(k, v));
      return reply.redirect(webUrl.toString());
    }

    // Standalone mode: serve built-in HTML consent page
    const html = buildConsentHtml(config.apiBaseUrl, params);
    return reply.header('Content-Type', 'text/html; charset=utf-8').send(html);
  });

  // ── POST /oauth/consent — Issue code after Clerk auth or regular JWT ────
  // Called by the web app (Clerk JWT) or standalone HTML form (Fastify JWT)
  app.post('/oauth/consent', async (request, reply) => {
    const authHeader = request.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    const { userRepository, workspaceRepository, oauthService } = getContainer();

    let authResult: { user: { id: string }; workspaceId: string } = { user: { id: '' }, workspaceId: '' };

    // Try Clerk JWT first (hosted version)
    let clerkOk = false;
    if (token.includes('.') && config.clerkSecretKey) {
      try {
        const r = await verifyAndUpsertClerkUser(token, userRepository, workspaceRepository);
        authResult = r;
        clerkOk = true;
      } catch { /* fall through */ }
    }

    // Fallback: regular Fastify JWT (standalone / self-hosted)
    if (!clerkOk) {
      try {
        const payload = app.jwt.verify<{ sub: string; email: string }>(token);
        const user = await userRepository.findById(payload.sub);
        if (!user) return reply.status(401).send({ error: 'invalid_token' });
        const workspaces = await workspaceRepository.listForUser(user.id);
        const personal = workspaces.find(w => w.type === 'personal') ?? workspaces[0];
        authResult = { user, workspaceId: personal?.id ?? '' };
      } catch {
        return reply.status(401).send({ error: 'invalid_token' });
      }
    }

    const body = request.body as Record<string, string>;

    // Allow choosing a specific workspace (for team members).
    // Fall back to the user's personal workspace if not provided or not a member.
    let workspaceId = authResult.workspaceId;
    if (body.workspace_id && body.workspace_id !== workspaceId) {
      const member = await workspaceRepository.getMember(body.workspace_id, authResult.user.id);
      if (member) workspaceId = body.workspace_id;
    }

    try {
      const redirectUrl = await oauthService.processConsentWithUserId({
        ...body,
        user_id: authResult.user.id,
        workspace_id: workspaceId,
      });
      return reply.send({ redirect_url: redirectUrl });
    } catch (err) {
      const msg = err instanceof AppError ? err.message : 'invalid_request';
      return reply.status(400).send({ error: msg });
    }
  });

  // ── POST /oauth/token — Exchange code or refresh token ───────────────────
  app.post('/oauth/token', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const { oauthService } = getContainer();

    try {
      let token;

      if (body['grant_type'] === 'refresh_token') {
        // Refresh token rotation
        const refreshToken = body['refresh_token'];
        const clientId = body['client_id'];
        if (!refreshToken || !clientId) {
          return reply.status(400).send({ error: 'invalid_request', error_description: 'refresh_token and client_id required' });
        }
        token = await oauthService.refreshAccessToken(refreshToken, clientId);
      } else {
        // Authorization code exchange
        const Schema = z.object({
          grant_type: z.string(),
          code: z.string(),
          redirect_uri: z.string(),
          client_id: z.string(),
          code_verifier: z.string(),
        });
        const parsed = Schema.parse(body);
        token = await oauthService.exchangeCode(parsed);
      }

      return reply
        .header('Cache-Control', 'no-store')
        .header('Pragma', 'no-cache')
        .send(token);
    } catch (err) {
      const msg = err instanceof AppError ? err.message : 'invalid_grant';
      return reply.status(400).send({ error: 'invalid_grant', error_description: msg });
    }
  });

  // ── POST /oauth/introspect — Token validation (called by MCP server) ─────
  app.post('/oauth/introspect', async (request, reply) => {
    const { token } = request.body as { token?: string };
    if (!token) return reply.send({ active: false });

    const { oauthService } = getContainer();
    const result = await oauthService.introspect(token);
    return reply.send(result);
  });
}

// ── Built-in HTML consent page (standalone / self-hosted mode) ───────────────
// No Clerk, no React. Plain HTML + Fetch API.
// Used when WEB_BASE_URL is not set or points to the API itself.
function buildConsentHtml(apiBase: string, params: Record<string, string>): string {
  const paramsJson = JSON.stringify(params);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect Claude Code — Tendon</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #080809;
      --surface: #0f0f12;
      --border: rgba(255,255,255,0.07);
      --border-hover: rgba(255,255,255,0.13);
      --text: #e8e8ec;
      --muted: #6b6b78;
      --subtle: #3a3a44;
      --accent: #e8b84b;
      --accent-dim: rgba(232,184,75,0.12);
      --accent-border: rgba(232,184,75,0.3);
      --blue: #4f8ef7;
      --blue-dim: rgba(79,142,247,0.08);
      --blue-border: rgba(79,142,247,0.2);
      --red-dim: rgba(239,68,68,0.08);
      --red-border: rgba(239,68,68,0.2);
      --red-text: #fca5a5;
      --success: #34d399;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
      background: var(--bg); color: var(--text);
      min-height: 100vh; display: flex; flex-direction: column;
      align-items: center; justify-content: center; padding: 24px;
    }

    /* Subtle grid background */
    body::before {
      content: '';
      position: fixed; inset: 0; pointer-events: none;
      background-image:
        linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
      background-size: 40px 40px;
    }

    /* Glow */
    body::after {
      content: '';
      position: fixed; top: -20%; left: 50%; transform: translateX(-50%);
      width: 600px; height: 400px; pointer-events: none;
      background: radial-gradient(ellipse, rgba(232,184,75,0.04) 0%, transparent 70%);
    }

    .card {
      position: relative; z-index: 1;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px; padding: 36px 32px;
      width: 100%; max-width: 400px;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.03), 0 24px 48px rgba(0,0,0,0.5);
    }

    /* Progress steps */
    .steps {
      display: flex; align-items: center; justify-content: center;
      gap: 8px; margin-bottom: 28px;
    }
    .step-dot {
      width: 28px; height: 4px; border-radius: 2px;
      background: var(--subtle); transition: background 0.3s;
    }
    .step-dot.active { background: var(--accent); }
    .step-dot.done { background: var(--success); }

    /* Header */
    .logo {
      width: 52px; height: 52px; border-radius: 14px;
      background: var(--accent-dim); border: 1px solid var(--accent-border);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px;
    }
    h1 {
      font-size: 20px; font-weight: 700; text-align: center;
      margin-bottom: 6px; letter-spacing: -0.3px;
    }
    .sub {
      font-size: 13px; color: var(--muted); text-align: center;
      line-height: 1.5; margin-bottom: 28px;
    }

    /* Connect line */
    .connect-row {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px; border-radius: 12px;
      background: var(--blue-dim); border: 1px solid var(--blue-border);
      margin-bottom: 20px;
    }
    .connect-badge {
      font-size: 11px; font-weight: 600; padding: 2px 8px;
      border-radius: 4px; white-space: nowrap;
    }
    .badge-claude { background: rgba(99,102,241,0.15); color: #a5b4fc; }
    .badge-tendon { background: var(--accent-dim); color: var(--accent); }
    .connect-arrow { color: var(--muted); font-size: 14px; flex: 1; text-align: center; }

    /* Permissions */
    .perms {
      border-radius: 12px; padding: 14px 16px;
      border: 1px solid var(--border); margin-bottom: 20px;
    }
    .perms-title { font-size: 11px; color: var(--muted); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .perm {
      display: flex; align-items: center; gap: 10px;
      font-size: 13px; color: var(--text); padding: 4px 0;
    }
    .perm-icon {
      width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0;
      background: var(--blue-dim); border: 1px solid var(--blue-border);
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; color: var(--blue);
    }

    /* Form */
    .field { margin-bottom: 12px; }
    label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 5px; font-weight: 500; }
    input {
      width: 100%; padding: 11px 14px;
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border);
      border-radius: 10px; color: var(--text);
      font-size: 14px; outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    input:focus {
      border-color: rgba(79,142,247,0.4);
      box-shadow: 0 0 0 3px rgba(79,142,247,0.08);
    }
    input::placeholder { color: var(--subtle); }

    /* Workspace selector */
    .ws-section { margin-bottom: 16px; display: none; }
    .ws-title { font-size: 12px; color: var(--muted); margin-bottom: 8px; font-weight: 500; }
    .ws-btn {
      width: 100%; display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; background: transparent;
      border-radius: 10px; cursor: pointer;
      border: 1px solid var(--border); color: var(--text);
      font-size: 13px; text-align: left; margin-bottom: 6px;
      transition: border-color 0.15s, background 0.15s;
    }
    .ws-btn:hover { border-color: var(--border-hover); background: rgba(255,255,255,0.02); }
    .ws-btn.selected { border-color: var(--accent-border); background: var(--accent-dim); }
    .ws-indicator {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
      border: 2px solid var(--subtle); transition: all 0.15s;
    }
    .ws-btn.selected .ws-indicator { background: var(--accent); border-color: var(--accent); }
    .ws-tag {
      margin-left: auto; font-size: 10px; padding: 2px 6px;
      border-radius: 4px; background: var(--subtle); color: var(--muted);
    }
    .ws-btn.selected .ws-tag { background: var(--accent-dim); color: var(--accent); }

    /* Buttons */
    .btn-primary {
      width: 100%; padding: 12px; background: var(--accent); color: #0a0a0b;
      border: none; border-radius: 10px; font-size: 14px; font-weight: 700;
      cursor: pointer; margin-bottom: 8px; letter-spacing: -0.1px;
      transition: opacity 0.15s, transform 0.1s;
    }
    .btn-primary:hover:not(:disabled) { opacity: 0.92; }
    .btn-primary:active:not(:disabled) { transform: scale(0.99); }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-secondary {
      width: 100%; padding: 10px; background: none; border: none;
      color: var(--muted); font-size: 13px; cursor: pointer;
      border-radius: 8px; transition: color 0.15s;
    }
    .btn-secondary:hover { color: var(--text); }

    /* Error */
    .error {
      display: none; align-items: center; gap: 8px;
      background: var(--red-dim); border: 1px solid var(--red-border);
      border-radius: 10px; padding: 10px 14px;
      font-size: 13px; color: var(--red-text); margin-bottom: 14px;
    }
    .error.visible { display: flex; }

    /* Loading spinner */
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner {
      display: inline-block; width: 14px; height: 14px;
      border: 2px solid rgba(10,10,11,0.3);
      border-top-color: #0a0a0b;
      border-radius: 50%; animation: spin 0.7s linear infinite;
      vertical-align: middle; margin-right: 6px;
    }

    /* Step fade transition */
    .step-panel { animation: fadeIn 0.2s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    .divider { height: 1px; background: var(--border); margin: 20px 0; }

    .footer {
      margin-top: 20px; text-align: center;
      font-size: 11px; color: var(--subtle);
    }
    .footer a { color: var(--muted); text-decoration: none; }
    .footer a:hover { color: var(--text); }
  </style>
</head>
<body>
  <div class="card">
    <!-- Progress -->
    <div class="steps">
      <div class="step-dot active" id="dot-1"></div>
      <div class="step-dot" id="dot-2"></div>
    </div>

    <!-- Logo -->
    <div class="logo">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="#e8b84b" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <h1>Connect Claude Code</h1>
    <p class="sub">Sign in to your Tendon account to authorize<br>Claude Code access to your workspace</p>

    <!-- Error -->
    <div class="error" id="error">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="flex-shrink:0">
        <circle cx="12" cy="12" r="10" stroke="#fca5a5" stroke-width="2"/>
        <path d="M12 8v4M12 16h.01" stroke="#fca5a5" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span id="error-text"></span>
    </div>

    <!-- Step 1: Sign in -->
    <div id="login-step" class="step-panel">
      <div class="field">
        <label for="email">Email address</label>
        <input id="email" type="email" placeholder="you@example.com" autocomplete="email">
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" type="password" placeholder="••••••••" autocomplete="current-password">
      </div>
      <button class="btn-primary" id="login-btn" onclick="login()">Continue →</button>
      <button class="btn-secondary" onclick="deny()">Cancel</button>
    </div>

    <!-- Step 2: Authorize -->
    <div id="allow-step" style="display:none" class="step-panel">
      <!-- Claude ↔ Tendon visual -->
      <div class="connect-row">
        <span class="connect-badge badge-claude">Claude Code</span>
        <span class="connect-arrow">↔</span>
        <span class="connect-badge badge-tendon">Tendon</span>
      </div>

      <!-- Workspace selector -->
      <div class="ws-section" id="ws-section">
        <p class="ws-title">Connect to workspace</p>
        <div id="ws-buttons"></div>
      </div>

      <!-- Permissions -->
      <div class="perms">
        <p class="perms-title">Claude will be able to</p>
        <div class="perm">
          <span class="perm-icon">✓</span>
          <span>View and create tasks</span>
        </div>
        <div class="perm">
          <span class="perm-icon">⏱</span>
          <span>Log focus sessions and time</span>
        </div>
        <div class="perm">
          <span class="perm-icon">📋</span>
          <span>Read your daily plan</span>
        </div>
      </div>

      <button class="btn-primary" id="allow-btn" onclick="allow()">Allow access</button>
      <button class="btn-secondary" onclick="deny()">Cancel</button>
    </div>
  </div>

  <div class="footer">
    Secured by <a href="https://tendon.alashed.kz" target="_blank">Tendon</a> · OAuth 2.1 + PKCE
  </div>

  <script>
    const API = '${apiBase}';
    const PARAMS = ${paramsJson};
    let jwt = null;
    let selectedWorkspaceId = null;

    function showError(msg) {
      document.getElementById('error-text').textContent = msg;
      document.getElementById('error').classList.add('visible');
    }
    function hideError() {
      document.getElementById('error').classList.remove('visible');
    }

    function setStep(n) {
      document.getElementById('dot-1').className = 'step-dot ' + (n >= 1 ? (n > 1 ? 'done' : 'active') : '');
      document.getElementById('dot-2').className = 'step-dot ' + (n >= 2 ? 'active' : '');
    }

    function renderWorkspaces(workspaces) {
      if (workspaces.length <= 1) return;
      const container = document.getElementById('ws-buttons');
      workspaces.forEach(ws => {
        const btn = document.createElement('button');
        btn.className = 'ws-btn' + (ws.id === selectedWorkspaceId ? ' selected' : '');
        btn.innerHTML =
          '<span class="ws-indicator"></span>' +
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + ws.name + '</span>' +
          '<span class="ws-tag">' + ws.type + '</span>';
        btn.onclick = () => {
          selectedWorkspaceId = ws.id;
          document.querySelectorAll('.ws-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        };
        container.appendChild(btn);
      });
      document.getElementById('ws-section').style.display = 'block';
    }

    async function login() {
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      if (!email || !password) { showError('Email and password required'); return; }

      hideError();
      const btn = document.getElementById('login-btn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Signing in…';

      try {
        const res = await fetch(API + '/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) { showError(data.error || 'Invalid credentials'); return; }

        jwt = data.data.token;
        const workspaces = data.data.workspaces ?? [];
        const personal = workspaces.find(w => w.type === 'personal') ?? workspaces[0];
        selectedWorkspaceId = personal?.id ?? null;
        renderWorkspaces(workspaces);

        setStep(2);
        document.getElementById('login-step').style.display = 'none';
        const allowStep = document.getElementById('allow-step');
        allowStep.style.display = 'block';
        allowStep.classList.remove('step-panel');
        void allowStep.offsetWidth;
        allowStep.classList.add('step-panel');
      } catch {
        showError('Network error — is the API running?');
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Continue →';
      }
    }

    async function allow() {
      hideError();
      const btn = document.getElementById('allow-btn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Authorizing…';

      try {
        const body = selectedWorkspaceId ? { ...PARAMS, workspace_id: selectedWorkspaceId } : PARAMS;
        const res = await fetch(API + '/oauth/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (res.ok && data.redirect_url) {
          window.location.href = data.redirect_url;
        } else {
          showError(data.error || 'Authorization failed');
          btn.disabled = false;
          btn.innerHTML = 'Allow access';
        }
      } catch {
        showError('Network error');
        btn.disabled = false;
        btn.innerHTML = 'Allow access';
      }
    }

    function deny() {
      if (PARAMS.redirect_uri) {
        try {
          const url = new URL(PARAMS.redirect_uri);
          url.searchParams.set('error', 'access_denied');
          if (PARAMS.state) url.searchParams.set('state', PARAMS.state);
          window.location.href = url.toString();
        } catch { window.history.back(); }
      }
    }

    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      if (document.getElementById('login-step').style.display !== 'none') login();
      else allow();
    });
  </script>
</body>
</html>`;
}
