// RFC 9728: OAuth Protected Resource Metadata — lives on main domain (tendon.alashed.kz)
// MCP returns 401 with resource_metadata pointing here; client fetches this to discover auth server
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tendon.alashed.kz';
const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL ?? 'https://mcp.tendon.alashed.kz/mcp';

export function GET() {
  const body = {
    resource: MCP_URL,
    resource_name: 'Tendon MCP',
    authorization_servers: [API_URL],
    bearer_methods_supported: ['header'],
    scopes_supported: ['mcp'],
  };
  return Response.json(body, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'application/json',
    },
  });
}
