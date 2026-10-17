import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";

import { manifest } from "@/manifest";

import type { DevErrorHint } from "./hints";
import type {
  DevErrorPageFrame,
  DevErrorPageSource,
  DevErrorRuntime,
} from "./render";
import type { DevErrorFrame } from "./stack";

import { renderDevErrorPage } from "./render";
import { createFrameMapper } from "./source-map";
import { isUrl, parseStackFrames } from "./stack";

const DEV_ERROR_DOCS_URL = "https://vitnode.com/docs/dev/debugging/error-page";

const SOURCE_CONTEXT_LINES = 5;

const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);

export interface DevErrorReport {
  dismissible?: boolean;
  error: { message: string; name: string; stack: string };
  hints: DevErrorHint[];
  method: string;
  origin?: string;
  path: string;
  runtime?: DevErrorRuntime;
  status: number;
}

const findWorkspaceRoot = (start: string): string => {
  let current = start;

  while (dirname(current) !== current) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) return current;
    current = dirname(current);
  }

  return start;
};

let workspaceRoot: string | undefined;

const getWorkspaceRoot = (): string => {
  workspaceRoot ??= findWorkspaceRoot(process.cwd());

  return workspaceRoot;
};

const displayFile = (file: string): string => {
  if (isUrl(file)) {
    return decodeURIComponent(new URL(file).pathname).replace(/^\/(@fs)?/, "");
  }
  if (!file.startsWith("/")) return file;

  const nodeModulesAt = file.lastIndexOf("/node_modules/");
  if (nodeModulesAt !== -1) return file.slice(nodeModulesAt + 1);

  const fromRoot = relative(getWorkspaceRoot(), file);

  return fromRoot.startsWith("..") ? file : fromRoot;
};

const isReadableSource = (file: string): boolean => {
  const fromRoot = relative(getWorkspaceRoot(), file);

  return (
    file.startsWith("/") &&
    SOURCE_EXTENSIONS.has(extname(file)) &&
    !fromRoot.startsWith("..") &&
    !fromRoot.split("/").some(segment => segment.startsWith("."))
  );
};

const readSource = async (
  frame: DevErrorPageFrame,
): Promise<DevErrorPageSource | null> => {
  if (!isReadableSource(frame.file)) return null;

  const text = await readFile(frame.file, "utf8").catch(() => null);
  if (text === null) return null;

  const lines = text.split("\n");
  const start = Math.max(1, frame.line - SOURCE_CONTEXT_LINES);
  const end = Math.min(lines.length, frame.line + SOURCE_CONTEXT_LINES);

  return { frame, lines: lines.slice(start - 1, end), start };
};

const withDisplayFile = (frame: DevErrorFrame): DevErrorPageFrame => ({
  ...frame,
  displayFile: displayFile(frame.file),
});

export const buildDevErrorPage = async ({
  dismissible = false,
  error,
  hints,
  method,
  origin,
  path,
  runtime = "server",
  status,
}: DevErrorReport): Promise<string> => {
  const mapFrame = createFrameMapper({ appRoot: process.cwd(), origin });
  const mappedFrames = await Promise.all(
    parseStackFrames(error.stack).map(mapFrame),
  );
  const frames = mappedFrames.map(withDisplayFile);
  const firstAppFrame = frames.find(frame => frame.isApp);

  return renderDevErrorPage({
    dismissible,
    docsUrl: DEV_ERROR_DOCS_URL,
    error: { message: error.message, name: error.name },
    frames,
    hints,
    method,
    path,
    runtime,
    source: firstAppFrame ? await readSource(firstAppFrame) : null,
    status,
    version: manifest.version,
  });
};
