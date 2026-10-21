import type { DevErrorRuntime } from "./render";

import { buildErrorHints } from "./build-hints";
import { devErrorHintsOf } from "./hints";
import { buildDevErrorPage } from "./page";

const MAX_TEXT_LENGTH = 50_000;

interface ReportEvent {
  req: Request;
}

interface ReportBody {
  hints: unknown;
  message: string;
  name: string;
  path: string;
  runtime: DevErrorRuntime;
  stack: string;
}

const runtimeOf = (value: unknown): DevErrorRuntime =>
  value === "browser" || value === "build" ? value : "server";

const textField = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value.slice(0, MAX_TEXT_LENGTH) : fallback;

const parseBody = (value: unknown): null | ReportBody => {
  if (typeof value !== "object" || value === null) return null;

  const body = value as Record<string, unknown>;
  if (typeof body.message !== "string" || typeof body.path !== "string") {
    return null;
  }

  return {
    hints: body.hints,
    message: textField(body.message, ""),
    name: textField(body.name, "Error"),
    path: body.path.startsWith("/") ? textField(body.path, "/") : "/",
    runtime: runtimeOf(body.runtime),
    stack: textField(body.stack, ""),
  };
};

const plainResponse = (status: number) =>
  new Response(null, { headers: { "cache-control": "no-store" }, status });

const devErrorReportHandler = async ({
  req,
}: ReportEvent): Promise<Response> => {
  if (process.env.NODE_ENV === "production") return plainResponse(404);
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return plainResponse(415);
  }

  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin") {
    return plainResponse(403);
  }

  const body = parseBody(await req.json().catch(() => null));
  if (!body) return plainResponse(400);

  const html = await buildDevErrorPage({
    dismissible: true,
    error: { message: body.message, name: body.name, stack: body.stack },
    hints: [
      ...devErrorHintsOf({ hints: body.hints }),
      ...(body.runtime === "build" ? buildErrorHints(body.message) : []),
    ].slice(0, 3),
    method: "GET",
    origin: new URL(req.url).origin,
    path: body.path,
    runtime: body.runtime,
    status: 500,
  });

  return new Response(html, {
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
    },
  });
};

export default devErrorReportHandler;
