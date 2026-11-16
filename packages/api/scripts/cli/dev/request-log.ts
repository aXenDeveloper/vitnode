import type { Ui } from "../ui/ui";

import { padEnd, padStart } from "../ui/colors";
import { formatDuration } from "../ui/format";

export interface LoggedRequest {
  accept?: string;
  method: string;
  url: string;
}

/** Vite's own module traffic: thousands of requests nobody needs to read. */
const INTERNAL_PREFIXES = ["/@", "/node_modules/", "/__", "/.well-known/"];

const STATIC_EXTENSION =
  /\.(?:css|gif|ico|jpe?g|js|json|jsx|map|mjs|mts|png|svg|ts|tsx|txt|webmanifest|webp|woff2?)$/i;

/**
 * Whether a dev-server request is one a developer would recognise as theirs:
 * a page, an API call, a server function, a form post. Module requests,
 * HMR pings and static files are left out - they are the dev server talking to
 * itself.
 */
export const shouldLogRequest = ({ accept, method, url }: LoggedRequest) => {
  const path = url.split("?")[0] ?? url;

  if (INTERNAL_PREFIXES.some(prefix => path.startsWith(prefix))) return false;
  if (/[?&](?:import|direct|raw|url|worker|t|v)(?:=|&|$)/.test(url))
    return false;
  if (path.startsWith("/api/") || path === "/api") return true;
  if (path.startsWith("/_serverFn")) return true;
  if (method !== "GET" && method !== "HEAD") return true;
  if (STATIC_EXTENSION.test(path)) return false;

  return (
    accept === undefined ||
    accept.includes("text/html") ||
    accept.includes("*/*")
  );
};

/** `GET   /api/session     200    6ms` - aligned, status colored by class. */
export const formatRequest = (
  ui: Ui,
  {
    durationMs,
    method,
    status,
    url,
  }: { durationMs: number; method: string; status: number; url: string },
): string => {
  const paint =
    status >= 500
      ? ui.colors.error
      : status >= 400
        ? ui.colors.warning
        : status >= 300
          ? ui.colors.muted
          : ui.colors.success;
  const path = url.length > 48 ? `${url.slice(0, 47)}…` : url;

  return `${ui.colors.muted(padEnd(method, 6))}${padEnd(path, 48)} ${paint(padStart(String(status), 3))}  ${ui.colors.muted(padStart(formatDuration(durationMs), 6))}`;
};

export const formatHotUpdate = (ui: Ui, file: string): string =>
  `${ui.colors.primary(padEnd("HMR", 6))}${file}`;
