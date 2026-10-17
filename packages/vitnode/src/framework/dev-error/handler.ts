import { devErrorHintsOf } from "./hints";
import { buildDevErrorPage } from "./page";

interface ServerError extends Error {
  status?: unknown;
  unhandled?: unknown;
}

interface ServerErrorEvent {
  req: Request;
}

const unwrap = (error: ServerError): ServerError =>
  error.name === "HTTPError" &&
  error.unhandled === true &&
  error.cause instanceof Error
    ? error.cause
    : error;

const statusOf = (error: ServerError): number =>
  typeof error.status === "number" && error.status >= 400 && error.status < 600
    ? error.status
    : 500;

const devErrorHandler = async (
  thrown: ServerError,
  event: ServerErrorEvent,
): Promise<Response | undefined> => {
  if (process.env.NODE_ENV === "production") return;
  if (!event.req.headers.get("accept")?.includes("text/html")) return;

  const status = statusOf(thrown);
  if (thrown.unhandled !== true && status < 500) return;

  const error = unwrap(thrown);
  const url = new URL(event.req.url);

  const html = await buildDevErrorPage({
    error: {
      message: error.message,
      name: error.name,
      stack: error.stack ?? "",
    },
    hints: devErrorHintsOf(error),
    method: event.req.method,
    origin: url.origin,
    path: `${url.pathname}${url.search}`,
    status,
  });

  return new Response(html, {
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
    },
    status,
  });
};

export default devErrorHandler;
