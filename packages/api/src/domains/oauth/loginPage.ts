function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export interface AuthorizeParams {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  state?: string;
  scope?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

export function renderLoginPage(params: AuthorizeParams, error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sign in · Alashed Tracker</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #f5f5f5; display: flex; align-items: center;
         justify-content: center; min-height: 100vh; }
  .card { background: #fff; border-radius: 12px; padding: 40px;
          width: 100%; max-width: 400px; box-shadow: 0 2px 16px rgba(0,0,0,.08); }
  .logo { font-size: 22px; font-weight: 700; color: #111; margin-bottom: 6px; }
  .sub  { font-size: 14px; color: #666; margin-bottom: 28px; }
  .error { background: #fff0f0; border: 1px solid #fcc; color: #c00;
           border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }
  label { display: block; font-size: 13px; font-weight: 500;
          color: #333; margin-bottom: 5px; }
  input[type=email], input[type=password] {
    width: 100%; padding: 10px 12px; border: 1px solid #ddd;
    border-radius: 8px; font-size: 14px; outline: none; margin-bottom: 16px;
    transition: border-color .15s; }
  input:focus { border-color: #5b6af0; }
  button { width: 100%; padding: 11px; background: #5b6af0; color: #fff;
           border: none; border-radius: 8px; font-size: 15px; font-weight: 600;
           cursor: pointer; transition: background .15s; }
  button:hover { background: #4a59df; }
  .footer { margin-top: 20px; font-size: 12px; color: #999; text-align: center; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">Alashed Tracker</div>
  <div class="sub">Sign in to connect to Claude Code</div>
  ${error ? `<div class="error">${esc(error)}</div>` : ''}
  <form method="POST" action="/oauth/authorize">
    <input type="hidden" name="response_type"         value="${esc(params.response_type ?? '')}">
    <input type="hidden" name="client_id"             value="${esc(params.client_id ?? '')}">
    <input type="hidden" name="redirect_uri"          value="${esc(params.redirect_uri ?? '')}">
    <input type="hidden" name="state"                 value="${esc(params.state ?? '')}">
    <input type="hidden" name="scope"                 value="${esc(params.scope ?? '')}">
    <input type="hidden" name="code_challenge"        value="${esc(params.code_challenge ?? '')}">
    <input type="hidden" name="code_challenge_method" value="${esc(params.code_challenge_method ?? '')}">
    <label for="email">Email</label>
    <input type="email" id="email" name="email" placeholder="you@example.com"
           required autocomplete="email">
    <label for="password">Password</label>
    <input type="password" id="password" name="password" placeholder="••••••••"
           required autocomplete="current-password">
    <button type="submit">Sign in &amp; Connect</button>
  </form>
  <div class="footer">By signing in you allow Claude Code to access your workspace.</div>
</div>
</body>
</html>`;
}
