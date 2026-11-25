import { handleMcpRequest } from "@/lib/mcp-server";

export function POST(request: Request) {
  return handleMcpRequest(request, true);
}
