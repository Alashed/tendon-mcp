export interface OAuthClient {
  id: string;
  client_id: string;
  client_secret: string | null;
  client_name: string | null;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  scope: string | null;
  created_at: string;
}

export interface OAuthCode {
  id: string;
  code: string;
  client_id: string;
  user_id: string;
  workspace_id: string;
  redirect_uri: string;
  scope: string | null;
  code_challenge: string;
  code_challenge_method: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

export interface OAuthAccessToken {
  id: string;
  token: string;
  client_id: string;
  user_id: string;
  workspace_id: string;
  scope: string | null;
  expires_at: string;
  revoked: boolean;
  created_at: string;
}

export interface OAuthRefreshToken {
  id: string;
  token: string;
  client_id: string;
  user_id: string;
  workspace_id: string;
  scope: string | null;
  expires_at: string;
  used: boolean;
  created_at: string;
}

export interface IntrospectionResult extends OAuthAccessToken {
  user_email: string;
}
