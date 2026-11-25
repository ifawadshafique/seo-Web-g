import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { privateHeaders } from "@/lib/auth";
import { ContentError } from "@/lib/api-error";
import { boundedJson } from "@/lib/request-body";

const testOrigin = "https://seo-web-mcp-test.vercel.app";

export async function POST(request: Request) {
  if (process.env.APP_ENV !== "staging" || process.env.SITE_URL !== testOrigin)
    return new Response(null, { status: 404, headers: privateHeaders });

  const origin = request.headers.get("origin");
  if (origin && origin !== testOrigin)
    return new Response(null, { status: 403, headers: privateHeaders });

  let parsedBody: unknown;
  try {
    parsedBody = await boundedJson(request, 20000);
  } catch (error) {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Invalid or oversized request body" },
      },
      {
        status: error instanceof ContentError ? error.status : 400,
        headers: privateHeaders,
      },
    );
  }

  const server = new McpServer({ name: "Workboard Demo", version: "1.0.0" });
  server.registerTool(
    "preview_job_draft",
    {
      description:
        "Preview a sample Workboard job draft. Returns a preview without saving or publishing it.",
      inputSchema: {
        title: z.string().trim().min(1).max(200),
        company: z.string().trim().min(1).max(200),
        description: z.string().trim().min(1).max(4000),
      },
      annotations: { readOnlyHint: true },
    },
    async (draft) => ({
      content: [
        { type: "text", text: JSON.stringify({ ...draft, saved: false }) },
      ],
    }),
  );
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request, { parsedBody });
    Object.entries(privateHeaders).forEach(([key, value]) =>
      response.headers.set(key, value),
    );
    return response;
  } finally {
    await server.close();
  }
}
