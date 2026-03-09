import { createHash } from 'crypto';
import { OAuthRepository } from './OAuthRepository.js';
import { UserRepository } from '../users/UserRepository.js';
import { WorkspaceRepository } from '../workspaces/WorkspaceRepository.js';
import { AppError } from '../../shared/errors/AppError.js';
import type { OAuthAccessToken } from './types.js';

function hashPassword(p: string): string {
  return createHash('sha256').update(p).digest('hex');
}

function verifyPKCE(verifier: string, challenge: string): boolean {
  const computed = createHash('sha256').update(verifier).digest('base64url');
  return computed === challenge;
}

export interface AuthorizeParams {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
}

export interface TokenRequest {
  grant_type: string;
  code: string;
  redirect_uri: string;
  client_id: string;
  code_verifier: string;
}

export class OAuthService {
  constructor(
    private readonly oauthRepo: OAuthRepository,
    private readonly userRepo: UserRepository,
    private readonly workspaceRepo: WorkspaceRepository,
  ) {}

  async registerClient(dto: {
    client_name?: string;
    redirect_uris: string[];
    grant_types?: string[];
    response_types?: string[];
    token_endpoint_auth_method?: string;
    scope?: string;
  }) {
    return this.oauthRepo.createClient(dto);
  }

  async validateAuthorizeRequest(params: AuthorizeParams): Promise<void> {
    if (params.response_type !== 'code') {
      throw new AppError(400, 'unsupported_response_type');
    }
    if (!params.client_id) {
      throw new AppError(400, 'invalid_request: missing client_id');
    }
    if (!params.redirect_uri) {
      throw new AppError(400, 'invalid_request: missing redirect_uri');
    }
    if (!params.code_challenge) {
      throw new AppError(400, 'invalid_request: PKCE code_challenge required');
    }
    if (params.code_challenge_method !== 'S256') {
      throw new AppError(400, 'invalid_request: only S256 supported');
    }

    const client = await this.oauthRepo.findClientById(params.client_id);
    if (!client) throw new AppError(400, 'invalid_client');

    if (!client.redirect_uris.includes(params.redirect_uri)) {
      throw new AppError(400, 'invalid_request: redirect_uri mismatch');
    }
  }

  async processConsent(params: AuthorizeParams & { email?: string; password?: string }): Promise<string> {
    await this.validateAuthorizeRequest(params);

    // Authenticate user
    const user = await this.userRepo.findByEmail(params.email ?? '');
    if (!user || user.password_hash !== hashPassword(params.password ?? '')) {
      throw new AppError(401, 'Invalid email or password');
    }

    // Get personal workspace
    const workspaces = await this.workspaceRepo.listForUser(user.id);
    const workspace = workspaces.find(w => w.type === 'personal') ?? workspaces[0];
    if (!workspace) throw new AppError(400, 'No workspace found');

    // Issue code
    const oauthCode = await this.oauthRepo.createCode({
      client_id: params.client_id!,
      user_id: user.id,
      workspace_id: workspace.id,
      redirect_uri: params.redirect_uri!,
      scope: params.scope,
      code_challenge: params.code_challenge!,
      code_challenge_method: params.code_challenge_method!,
    });

    const url = new URL(params.redirect_uri!);
    url.searchParams.set('code', oauthCode.code);
    if (params.state) url.searchParams.set('state', params.state);
    return url.toString();
  }

  async exchangeCode(req: TokenRequest): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string | null;
  }> {
    if (req.grant_type !== 'authorization_code') {
      throw new AppError(400, 'unsupported_grant_type');
    }

    const code = await this.oauthRepo.findCode(req.code);
    if (!code) throw new AppError(400, 'invalid_grant: code not found or expired');
    if (code.client_id !== req.client_id) throw new AppError(400, 'invalid_grant: client_id mismatch');
    if (code.redirect_uri !== req.redirect_uri) throw new AppError(400, 'invalid_grant: redirect_uri mismatch');
    if (!verifyPKCE(req.code_verifier, code.code_challenge)) {
      throw new AppError(400, 'invalid_grant: PKCE verification failed');
    }

    // Mark used BEFORE issuing token (prevents replay)
    await this.oauthRepo.markCodeUsed(code.id);

    const token = await this.oauthRepo.createAccessToken({
      client_id: code.client_id,
      user_id: code.user_id,
      workspace_id: code.workspace_id,
      scope: code.scope ?? undefined,
    });

    return {
      access_token: token.token,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: token.scope,
    };
  }

  async introspect(token: string): Promise<{
    active: boolean;
    sub?: string;
    email?: string;
    workspace_id?: string;
    scope?: string;
    client_id?: string;
    exp?: number;
  }> {
    const result = await this.oauthRepo.introspectToken(token);
    if (!result) return { active: false };

    return {
      active: true,
      sub: result.user_id,
      email: result.user_email,
      workspace_id: result.workspace_id,
      scope: result.scope ?? undefined,
      client_id: result.client_id,
      exp: Math.floor(new Date(result.expires_at).getTime() / 1000),
    };
  }
}
