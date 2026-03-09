import { randomBytes } from 'crypto';
import { query } from '../../shared/db/pool.js';
import type { OAuthClient, OAuthCode, OAuthAccessToken, IntrospectionResult } from './types.js';

export class OAuthRepository {
  async createClient(dto: {
    client_name?: string;
    redirect_uris: string[];
    grant_types?: string[];
    response_types?: string[];
    token_endpoint_auth_method?: string;
    scope?: string;
  }): Promise<OAuthClient> {
    const client_id = randomBytes(16).toString('hex');
    const result = await query<OAuthClient>(
      `INSERT INTO oauth_clients
        (client_id, client_name, redirect_uris, grant_types, response_types, token_endpoint_auth_method, scope)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        client_id,
        dto.client_name ?? null,
        dto.redirect_uris,
        dto.grant_types ?? ['authorization_code'],
        dto.response_types ?? ['code'],
        dto.token_endpoint_auth_method ?? 'none',
        dto.scope ?? null,
      ],
    );
    return result.rows[0]!;
  }

  async findClientById(clientId: string): Promise<OAuthClient | null> {
    const result = await query<OAuthClient>(
      'SELECT * FROM oauth_clients WHERE client_id = $1',
      [clientId],
    );
    return result.rows[0] ?? null;
  }

  async createCode(dto: {
    client_id: string;
    user_id: string;
    workspace_id: string;
    redirect_uri: string;
    scope?: string;
    code_challenge: string;
    code_challenge_method: string;
  }): Promise<OAuthCode> {
    const code = randomBytes(32).toString('hex');
    const result = await query<OAuthCode>(
      `INSERT INTO oauth_codes
        (code, client_id, user_id, workspace_id, redirect_uri, scope, code_challenge, code_challenge_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        code,
        dto.client_id,
        dto.user_id,
        dto.workspace_id,
        dto.redirect_uri,
        dto.scope ?? null,
        dto.code_challenge,
        dto.code_challenge_method,
      ],
    );
    return result.rows[0]!;
  }

  async findCode(code: string): Promise<OAuthCode | null> {
    const result = await query<OAuthCode>(
      `SELECT * FROM oauth_codes
       WHERE code = $1 AND used = FALSE AND expires_at > NOW()`,
      [code],
    );
    return result.rows[0] ?? null;
  }

  async markCodeUsed(id: string): Promise<void> {
    await query('UPDATE oauth_codes SET used = TRUE WHERE id = $1', [id]);
  }

  async createAccessToken(dto: {
    client_id: string;
    user_id: string;
    workspace_id: string;
    scope?: string;
  }): Promise<OAuthAccessToken> {
    const token = randomBytes(32).toString('hex');
    const result = await query<OAuthAccessToken>(
      `INSERT INTO oauth_access_tokens (token, client_id, user_id, workspace_id, scope)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [token, dto.client_id, dto.user_id, dto.workspace_id, dto.scope ?? null],
    );
    return result.rows[0]!;
  }

  async introspectToken(token: string): Promise<IntrospectionResult | null> {
    const result = await query<IntrospectionResult>(
      `SELECT t.*, u.email as user_email
       FROM oauth_access_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token = $1 AND t.revoked = FALSE AND t.expires_at > NOW()`,
      [token],
    );
    return result.rows[0] ?? null;
  }

  async revokeToken(token: string): Promise<void> {
    await query('UPDATE oauth_access_tokens SET revoked = TRUE WHERE token = $1', [token]);
  }
}
