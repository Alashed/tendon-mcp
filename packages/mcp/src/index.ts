import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import 'dotenv/config';
import { ApiClient } from './api-client.js';
import { validateBearerToken } from './auth.js';
import { registerTools } from './tools.js';

const PORT = parseInt(process.env['PORT'] ?? '3002', 10);
const API_URL = process.env['ALASHED_API_URL'] ?? 'http://localhost:3001';
const MCP_BASE_URL = process.env['MCP_BASE_URL'] ?? 'https://mcp.tracker.alashed.kz';

const app = express();
app.use(express.json());

// ── RFC 9728: Protected Resource Metadata ────────────────────────────────
app.get('/.well-known/oauth-protected-resource', (_req, res) => {
  res.json({
    resource: MCP_BASE_URL,
    authorization_servers: [API_URL.replace('http://localhost:3001', 'https://api.tracker.alashed.kz')],
    bearer_methods_supported: ['header'],
    scopes_supported: ['mcp'],
  });
});

// ── Health ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'alashed-mcp', ts: new Date().toISOString() });
});

// ── MCP endpoint ─────────────────────────────────────────────────────────
app.post('/mcp', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401)
      .set('WWW-Authenticate', `Bearer resource_metadata="${MCP_BASE_URL}/.well-known/oauth-protected-resource"`)
      .json({ error: 'missing_token', error_description: 'Authorization header required' });
    return;
  }

  let tokenInfo: Awaited<ReturnType<typeof validateBearerToken>>;
  try {
    tokenInfo = await validateBearerToken(token);
  } catch {
    res.status(401)
      .set('WWW-Authenticate', `Bearer resource_metadata="${MCP_BASE_URL}/.well-known/oauth-protected-resource", error="invalid_token"`)
      .json({ error: 'invalid_token', error_description: 'Token invalid or expired' });
    return;
  }

  const workspaceId = (req.headers['x-workspace-id'] as string) ?? tokenInfo.workspace_id;
  const api = new ApiClient(API_URL, token);

  const server = new McpServer({ name: 'alashed-tracker', version: '1.0.0' });
  registerTools(server, api, workspaceId);

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on('close', () => { transport.close(); server.close(); });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Alashed MCP server on port ${PORT}`);
  console.log(`API: ${API_URL} | MCP: ${MCP_BASE_URL}`);
});
