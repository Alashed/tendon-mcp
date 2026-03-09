import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getContainer } from '../../di/container.js';
import { config } from '../../config/index.js';
import { renderLoginPage } from '../../domains/oauth/loginPage.js';
import { AppError } from '../../shared/errors/AppError.js';

export async function oauthRoutes(app: FastifyInstance): Promise<void> {

  // ── RFC 8414: Authorization Server Metadata ─────────────────────────────
  app.get('/.well-known/oauth-authorization-server', async (_request, reply) => {
    const base = config.apiBaseUrl;
    return reply.send({
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      registration_endpoint: `${base}/oauth/register`,
      introspection_endpoint: `${base}/oauth/introspect`,
      scopes_supported: ['mcp'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
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

  // ── GET /oauth/authorize — Show login form ───────────────────────────────
  app.get('/oauth/authorize', async (request, reply) => {
    const params = request.query as Record<string, string>;
    const { oauthService } = getContainer();

    try {
      await oauthService.validateAuthorizeRequest(params);
    } catch (err) {
      const msg = err instanceof AppError ? err.message : 'Invalid request';
      return reply.status(400).send({ error: msg });
    }

    return reply
      .header('Content-Type', 'text/html; charset=utf-8')
      .send(renderLoginPage(params));
  });

  // ── POST /oauth/authorize — Process login + issue code ───────────────────
  app.post('/oauth/authorize', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const { oauthService } = getContainer();

    try {
      const redirectUrl = await oauthService.processConsent(body);
      return reply.redirect(redirectUrl);
    } catch (err) {
      const msg = err instanceof AppError ? err.message : 'Sign in failed';
      const html = renderLoginPage(body, msg);
      return reply
        .status(400)
        .header('Content-Type', 'text/html; charset=utf-8')
        .send(html);
    }
  });

  // ── POST /oauth/token — Exchange code for access token ───────────────────
  app.post('/oauth/token', async (request, reply) => {
    const Schema = z.object({
      grant_type: z.string(),
      code: z.string(),
      redirect_uri: z.string(),
      client_id: z.string(),
      code_verifier: z.string(),
    });

    const body = Schema.parse(request.body);
    const { oauthService } = getContainer();

    try {
      const token = await oauthService.exchangeCode(body);
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
