import { authorizedImageSource } from "./lib/image-url";
import { authenticatedCronRequest } from "./lib/cron-auth";
import { randomBytes } from "node:crypto";
import prisma from "./lib/prisma";
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from "next/server";
import { cspPolicy } from "./lib/csp";
import { effectiveCspMode, observeCsp } from "./lib/csp-audit";
import { recordTraffic } from "./lib/traffic";
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const path = request.nextUrl.pathname,
    appEnv = process.env.APP_ENV ?? "local";
  const html =
    !/^\/(api|_next|sitemaps)(\/|$)/.test(path) && !/[.][a-z0-9]+$/.test(path);
  const nonce = randomBytes(18).toString("base64");
  const policy = cspPolicy(nonce);
  const mode = html ? await effectiveCspMode() : "off";
  const incoming = new Headers(request.headers);
  incoming.set("x-page-path", path);
  incoming.set("x-nonce", nonce);
  incoming.delete("content-security-policy");
  incoming.delete("content-security-policy-report-only");
  if (mode !== "off") incoming.set("Content-Security-Policy", policy);
  const finish = (response: NextResponse) => {
    if (html && mode !== "off")
      response.headers.set(
        mode === "enforce"
          ? "Content-Security-Policy"
          : "Content-Security-Policy-Report-Only",
        policy,
      );
    if (appEnv !== "production")
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    if (/^\/(admin|login|api\/(auth|admin))(\/|$)/.test(path)) {
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    return response;
  };
  if (html && mode === "report-only")
    event.waitUntil(observeCsp().catch(() => {}));
  if (appEnv === "production") {
    const canonical = new URL(process.env.SITE_URL ?? request.url);
    const protocol =
      process.env.TRUST_PROXY === "true"
        ? (request.headers.get("x-forwarded-proto")?.split(",")[0] ??
          request.nextUrl.protocol.replace(":", ""))
        : request.nextUrl.protocol.replace(":", "");
    const host = request.headers.get("host") ?? request.nextUrl.host;
    if (
      host !== canonical.host ||
      (canonical.protocol === "https:" && protocol !== "https")
    ) {
      const target = new URL(canonical.origin);
      target.pathname = path;
      target.search = request.nextUrl.search;
      return finish(NextResponse.redirect(target, 301));
    }
  }
  const creds = process.env.STAGING_BASIC_AUTH;
  if (
    appEnv !== "production" &&
    creds &&
    !authenticatedCronRequest(request) &&
    !authorizedImageSource(path, request.nextUrl.searchParams) &&
    request.headers.get("authorization") !==
      "Basic " + Buffer.from(creds).toString("base64")
  )
    return finish(
      new NextResponse("Authentication required", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="staging"',
          "Cache-Control": "no-store",
        },
      }),
    );
  const missing = () => {
    event.waitUntil(recordTraffic("NOT_FOUND", path, 404).catch(() => {}));
    const response = NextResponse.rewrite(new URL("/404", request.url), {
      status: 404,
      request: { headers: incoming },
    });
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "no-store");
    return finish(response);
  };
  if (
    /^\/[a-z0-9-]+\/?$/.test(path) &&
    !/^\/(admin|login|contact|search|404|feed)\/?$/.test(path)
  ) {
    const fromPath = path.replace(/\/$/, "");
    const redirect = await prisma.redirect.findUnique({ where: { fromPath } });
    if (
      redirect &&
      redirect.toPath.startsWith("/") &&
      !redirect.toPath.startsWith("//")
    ) {
      event.waitUntil(
        recordTraffic("REDIRECT", fromPath, 301, redirect.toPath).catch(
          () => {},
        ),
      );
      return finish(
        NextResponse.redirect(new URL(redirect.toPath, request.url), 301),
      );
    }
    const [post, page] = await Promise.all([
      prisma.post.findFirst({
        where: {
          slug: fromPath.slice(1),
          status: "PUBLISHED",
          deletedAt: null,
          publishedAt: { lte: new Date() },
        },
        select: { id: true },
      }),
      prisma.page.findFirst({
        where: { slug: fromPath.slice(1), status: "PUBLISHED" },
        select: { id: true },
      }),
    ]);
    if (!post && !page) return missing();
  }
  const hub = /^\/(category|tag)\/([a-z0-9-]+)\/?$/.exec(path);
  if (hub) {
    const term =
      hub[1] === "category"
        ? await prisma.category.findUnique({
            where: { slug: hub[2] },
            select: { id: true },
          })
        : await prisma.tag.findUnique({
            where: { slug: hub[2] },
            select: { id: true },
          });
    if (!term) return missing();
  }
  return finish(NextResponse.next({ request: { headers: incoming } }));
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
