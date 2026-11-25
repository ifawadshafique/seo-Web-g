import { privateHeaders } from "@/lib/auth";
import { draftScope, mcpConfig } from "@/lib/mcp-auth";

export function GET() {
  const config = mcpConfig();
  if (!config)
    return new Response(null, { status: 404, headers: privateHeaders });
  return Response.json(
    {
      resource: config.resource,
      authorization_servers: [config.issuer],
      scopes_supported: [draftScope],
      bearer_methods_supported: ["header"],
    },
    { headers: privateHeaders },
  );
}
