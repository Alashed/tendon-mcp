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

  // ── POST /oauth/consent — Issue code after Clerk auth ───────────────────
  // Called by the web app after user approves in the Clerk-authenticated page
  app.post('/oauth/consent', async (request, reply) => {
    const authHeader = request.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    const { userRepository, workspaceRepository, oauthService } = getContainer();

    let authResult;
    try {
      authResult = await verifyAndUpsertClerkUser(token, userRepository, workspaceRepository);
    } catch {
      return reply.status(401).send({ error: 'invalid_token' });
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
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0c0c10; color: #e4e4e7;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      padding: 24px;
    }
    .card {
      background: #111115; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px; padding: 32px; width: 100%; max-width: 380px;
    }
    .icon {
      width: 48px; height: 48px; border-radius: 50%;
      background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.3);
      display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;
    }
    h1 { font-size: 18px; font-weight: 700; text-align: center; margin-bottom: 6px; }
    .sub { font-size: 13px; color: #71717a; text-align: center; margin-bottom: 24px; }
    .perms {
      background: rgba(59,130,246,0.05); border: 1px solid rgba(59,130,246,0.12);
      border-radius: 10px; padding: 14px; margin-bottom: 20px;
    }
    .perms p { font-size: 12px; color: #71717a; margin-bottom: 8px; }
    .perm { font-size: 12px; display: flex; gap: 8px; margin-bottom: 4px; }
    .perm span:first-child { color: #3b82f6; }
    label { display: block; font-size: 12px; color: #71717a; margin-bottom: 5px; }
    input {
      width: 100%; padding: 10px 12px; background: #18181f;
      border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
      color: #e4e4e7; font-size: 14px; margin-bottom: 12px; outline: none;
    }
    input:focus { border-color: rgba(59,130,246,0.5); }
    .btn-allow {
      width: 100%; padding: 11px; background: #e8b84b; color: #0c0c10;
      border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
      cursor: pointer; margin-bottom: 8px;
    }
    .btn-allow:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-cancel {
      width: 100%; padding: 10px; background: none; border: none;
      color: #52525b; font-size: 13px; cursor: pointer;
    }
    .error {
      background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
      border-radius: 8px; padding: 10px 12px; font-size: 13px; color: #fca5a5;
      margin-bottom: 12px; display: none;
    }
    .step { font-size: 12px; color: #52525b; text-align: center; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="#3b82f6" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <h1>Connect Claude Code</h1>
    <p class="sub">Sign in to authorize Claude Code access to your Tendon workspace</p>

    <div class="perms">
      <p>Claude will be able to:</p>
      <div class="perm"><span>✓</span><span>View and create tasks</span></div>
      <div class="perm"><span>✓</span><span>Log focus sessions and time</span></div>
      <div class="perm"><span>✓</span><span>Read your workspace plan</span></div>
    </div>

    <div id="error" class="error"></div>

    <div id="login-step">
      <p class="step">Step 1 of 2 — Sign in</p>
      <label for="email">Email</label>
      <input id="email" type="email" placeholder="you@example.com" autocomplete="email">
      <label for="password">Password</label>
      <input id="password" type="password" placeholder="••••••••" autocomplete="current-password">
      <button class="btn-allow" onclick="login()">Sign in →</button>
      <button class="btn-cancel" onclick="deny()">Cancel</button>
    </div>

    <div id="allow-step" style="display:none">
      <p class="step">Step 2 of 2 — Authorize</p>
      <button class="btn-allow" onclick="allow()">Allow access</button>
      <button class="btn-cancel" onclick="deny()">Cancel</button>
    </div>
  </div>

  <script>
    const API = '${apiBase}';
    const PARAMS = ${paramsJson};
    let jwt = null;

    function showError(msg) {
      const el = document.getElementById('error');
      el.textContent = msg;
      el.style.display = 'block';
    }

    async function login() {
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      if (!email || !password) { showError('Email and password required'); return; }

      document.querySelector('#login-step .btn-allow').disabled = true;
      document.getElementById('error').style.display = 'none';

      try {
        const res = await fetch(API + '/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) { showError(data.error || 'Invalid credentials'); return; }
        jwt = data.data.token;
        document.getElementById('login-step').style.display = 'none';
        document.getElementById('allow-step').style.display = 'block';
      } catch {
        showError('Network error — is the API running?');
      } finally {
        document.querySelector('#login-step .btn-allow').disabled = false;
      }
    }

    async function allow() {
      document.querySelector('#allow-step .btn-allow').disabled = true;
      document.getElementById('error').style.display = 'none';

      try {
        const res = await fetch(API + '/oauth/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt },
          body: JSON.stringify(PARAMS),
        });
        const data = await res.json();
        if (res.ok && data.redirect_url) {
          window.location.href = data.redirect_url;
        } else {
          showError(data.error || 'Authorization failed');
        }
      } catch {
        showError('Network error');
      } finally {
        document.querySelector('#allow-step .btn-allow').disabled = false;
      }
    }

    function deny() {
      if (PARAMS.redirect_uri) {
        const url = new URL(PARAMS.redirect_uri);
        url.searchParams.set('error', 'access_denied');
        if (PARAMS.state) url.searchParams.set('state', PARAMS.state);
        window.location.href = url.toString();
      }
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        if (document.getElementById('login-step').style.display !== 'none') login();
        else allow();
      }
    });
  </script>
</body>
</html>`;
}
