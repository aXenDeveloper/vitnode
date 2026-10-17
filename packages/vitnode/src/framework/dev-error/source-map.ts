import type { SourceMapPayload } from "node:module";

import { readFile } from "node:fs/promises";
import { SourceMap } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { DevErrorFrame } from "./stack";

import { isAppFile, isUrl } from "./stack";

const INLINE_SOURCE_MAP =
  /\/\/# sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,([A-Za-z0-9+/=]+)\s*$/;

export interface FrameMapperOptions {
  appRoot: string;
  origin?: string;
}

const parseSourceMap = (text: string): null | SourceMap => {
  try {
    return new SourceMap(JSON.parse(text) as SourceMapPayload);
  } catch {
    return null;
  }
};

const fetchInlineSourceMap = async (url: string): Promise<null | string> => {
  const response = await fetch(url).catch(() => null);
  if (!response?.ok) return null;

  const match = INLINE_SOURCE_MAP.exec(await response.text());

  return match ? Buffer.from(match[1], "base64").toString("utf8") : null;
};

const resolveSource = (
  file: string,
  sourceRoot: unknown,
  originalSource: string,
): string =>
  originalSource.startsWith("file://")
    ? fileURLToPath(originalSource)
    : resolve(
        dirname(file),
        typeof sourceRoot === "string" ? sourceRoot : "",
        originalSource,
      );

const originalColumnOf = (
  map: SourceMap,
  entry: {
    name?: string;
    originalColumn: number;
    originalLine: number;
    originalSource: string;
  },
): number => {
  const { sources, sourcesContent } = map.payload;
  const content: unknown = Array.isArray(sourcesContent)
    ? sourcesContent[sources.indexOf(entry.originalSource)]
    : undefined;
  if (!entry.name || typeof content !== "string") return entry.originalColumn;

  const line = content.split("\n")[entry.originalLine] ?? "";
  const at = line.indexOf(entry.name, entry.originalColumn);

  return at === -1 ? entry.originalColumn : at;
};

export const createFrameMapper = ({ appRoot, origin }: FrameMapperOptions) => {
  const maps = new Map<string, Promise<null | SourceMap>>();

  const fileSystemPath = (file: string): string => {
    if (!isUrl(file)) return file;

    const { pathname } = new URL(file);

    return pathname.startsWith("/@fs/")
      ? decodeURIComponent(pathname.slice("/@fs".length))
      : join(appRoot, decodeURIComponent(pathname));
  };

  const loadSourceMap = async (file: string): Promise<null | SourceMap> => {
    if (isUrl(file)) {
      if (!origin || new URL(file).origin !== origin) return null;
      const text = await fetchInlineSourceMap(file);

      return text === null ? null : parseSourceMap(text);
    }

    const text = await readFile(`${file}.map`, "utf8").catch(() => null);

    return text === null ? null : parseSourceMap(text);
  };

  const mapFor = async (file: string) => {
    const cached = maps.get(file);
    if (cached) return cached;

    const loading = loadSourceMap(file);
    maps.set(file, loading);

    return loading;
  };

  const mapFrame = async (frame: DevErrorFrame): Promise<DevErrorFrame> => {
    const map = await mapFor(frame.file);
    if (!map) return { ...frame, file: fileSystemPath(frame.file) };

    const entry = map.findEntry(frame.line - 1, frame.column - 1);
    if (!("originalSource" in entry)) {
      return { ...frame, file: fileSystemPath(frame.file) };
    }

    const file = resolveSource(
      fileSystemPath(frame.file),
      map.payload.sourceRoot,
      entry.originalSource,
    );

    return {
      ...frame,
      column: originalColumnOf(map, entry) + 1,
      file,
      isApp: isAppFile(file),
      line: entry.originalLine + 1,
    };
  };

  return async (frame: DevErrorFrame): Promise<DevErrorFrame> =>
    frame.isApp ? mapFrame(frame).catch(() => frame) : frame;
};
