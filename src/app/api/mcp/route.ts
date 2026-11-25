import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { ContentError, contentResult } from "@/lib/api-error";
import { privateHeaders } from "@/lib/auth";
import { cleanBody, postInput } from "@/lib/content-validation";
import { draftScope, mcpActor, mcpConfig } from "@/lib/mcp-auth";
import { pageInput, savePage } from "@/lib/page-publishing";
import prisma from "@/lib/prisma";
import { savePost } from "@/lib/publishing";
import { boundedJson } from "@/lib/request-body";
import { canAccess } from "@/lib/security";

const id = z.number().int().positive().max(2147483647);
const postDraft = postInput.omit({
  status: true,
  scheduledLocal: true,
  confirmShort: true,
});
const pageDraft = pageInput.omit({ status: true });
const readOnly = { readOnlyHint: true };

async function toolResult(run: () => Promise<unknown>) {
  const response = await contentResult(async () => Response.json(await run()));
  return {
    content: [{ type: "text" as const, text: await response.text() }],
    ...(response.ok ? {} : { isError: true }),
  };
}

function publishingServer(
  actor: NonNullable<Awaited<ReturnType<typeof mcpActor>>>,
) {
  const server = new McpServer({ name: "Workboard Drafts", version: "1.0.0" });
  const pagesAllowed = canAccess(actor.role, "settings");

  server.registerTool(
    "search_content",
    {
      description:
        "Find job and article titles, slugs, and statuses. Administrators can also search site pages.",
      inputSchema: {
        query: z.string().trim().max(200).default(""),
        limit: z.number().int().min(1).max(30).default(15),
      },
      annotations: readOnly,
    },
    ({ query, limit }) =>
      toolResult(async () => {
        const title = { contains: query, mode: "insensitive" as const };
        const select = {
          id: true,
          title: true,
          slug: true,
          status: true,
          updatedAt: true,
        };
        const [posts, pages] = await Promise.all([
          prisma.post.findMany({
            where: { deletedAt: null, title },
            orderBy: { updatedAt: "desc" },
            take: limit,
            select: { ...select, contentType: true },
          }),
          pagesAllowed
            ? prisma.page.findMany({
                where: { title },
                orderBy: { updatedAt: "desc" },
                take: limit,
                select,
              })
            : [],
        ]);
        return { posts, pages };
      }),
  );

  server.registerTool(
    "list_categories",
    {
      description: "Find category IDs for a job or article draft.",
      inputSchema: { query: z.string().trim().max(200).default("") },
      annotations: readOnly,
    },
    ({ query }) =>
      toolResult(() =>
        prisma.category.findMany({
          where: { name: { contains: query, mode: "insensitive" } },
          orderBy: { name: "asc" },
          take: 50,
          select: { id: true, name: true, slug: true },
        }),
      ),
  );

  server.registerTool(
    "create_post_draft",
    {
      description:
        "Create an unpublished job or article from HTML content. Look up a category ID first.",
      inputSchema: postDraft,
      annotations: { destructiveHint: false },
    },
    (input) =>
      toolResult(async () => {
        const { post, warnings } = await savePost(
          { ...input, status: "DRAFT" },
          actor,
        );
        return {
          id: post.id,
          slug: post.slug,
          status: post.status,
          adminPath: `/admin/posts/${post.id}`,
          warnings,
        };
      }),
  );

  server.registerTool(
    "edit_post_draft",
    {
      description:
        "Update the title and body of an existing job or article draft, preserving other fields.",
      inputSchema: {
        id,
        title: postDraft.shape.title,
        body: postDraft.shape.body,
      },
    },
    ({ id, title, body }) =>
      toolResult(async () => {
        const post = await prisma.$transaction(async (tx) => {
          const saved = await tx.post.update({
            where: { id, status: "DRAFT", deletedAt: null },
            data: { title, body: cleanBody(body) },
            select: { id: true, slug: true, status: true },
          });
          await tx.auditLog.create({
            data: {
              actorId: actor.id,
              action: "POST_DRAFT_SAVED",
              entityType: "Post",
              entityId: id,
            },
          });
          return saved;
        });
        return { ...post, adminPath: `/admin/posts/${id}` };
      }),
  );

  if (pagesAllowed)
    server.registerTool(
      "save_page_draft",
      {
        description:
          "Create or replace a draft site page at a supported slug. Published and archived pages are protected.",
        inputSchema: pageDraft,
      },
      (input) =>
        toolResult(async () => {
          const { id, slug, status } = await savePage(
            { ...input, status: "DRAFT" },
            actor.id,
            true,
          );
          return { id, slug, status, adminPath: "/admin/pages" };
        }),
    );

  return server;
}

export async function POST(request: Request) {
  const config = mcpConfig();
  if (!config)
    return new Response(null, { status: 404, headers: privateHeaders });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(config.resource).origin)
    return new Response(null, { status: 403, headers: privateHeaders });
  const actor = await mcpActor(request, config);
  if (!actor)
    return new Response(null, {
      status: 401,
      headers: {
        ...privateHeaders,
        "WWW-Authenticate": `Bearer resource_metadata="${config.metadata}", scope="${draftScope}"`,
      },
    });

  let parsedBody: unknown;
  try {
    parsedBody = await boundedJson(request, 1048576);
  } catch (error) {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Invalid or oversized request body",
        },
      },
      {
        status: error instanceof ContentError ? error.status : 400,
        headers: privateHeaders,
      },
    );
  }
  const server = publishingServer(actor);
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
