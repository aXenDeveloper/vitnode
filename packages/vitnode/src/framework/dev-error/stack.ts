import { fileURLToPath } from "node:url";

export interface DevErrorFrame {
  column: number;
  file: string;
  functionName: string;
  isApp: boolean;
  line: number;
}

const V8_FRAME_WITH_NAME = /^\s*at (?:async )?(.+?) \((.+):(\d+):(\d+)\)$/;
const V8_FRAME_WITHOUT_NAME = /^\s*at (?:async )?(.+):(\d+):(\d+)$/;
const GECKO_FRAME = /^\s*(.*?)@(.+):(\d+):(\d+)$/;

export const isUrl = (file: string): boolean => /^https?:\/\//.test(file);

const normalizeFile = (file: string): string => {
  if (isUrl(file)) return file;

  const withoutQuery = file.replace(/\?[^/]*$/, "");

  return withoutQuery.startsWith("file://")
    ? fileURLToPath(withoutQuery)
    : withoutQuery;
};

const urlPathname = (file: string): string => {
  const { pathname } = new URL(file);

  return pathname.startsWith("/@fs/")
    ? pathname.slice("/@fs".length)
    : pathname;
};

export const isAppFile = (file: string): boolean => {
  if (isUrl(file)) {
    const pathname = urlPathname(file);

    return (
      !pathname.includes("/node_modules/") &&
      (!pathname.startsWith("/@") || file.includes("/@fs/"))
    );
  }

  return file.startsWith("/") && !file.includes("/node_modules/");
};

const toFrame = (
  functionName: string,
  file: string,
  line: string,
  column: string,
): DevErrorFrame => {
  const normalized = normalizeFile(file);

  return {
    column: Number(column),
    file: normalized,
    functionName: functionName || "<anonymous>",
    isApp: isAppFile(normalized),
    line: Number(line),
  };
};

const parseLine = (text: string): DevErrorFrame | null => {
  const named = V8_FRAME_WITH_NAME.exec(text);
  if (named) {
    const [, functionName, file, line, column] = named;

    return toFrame(functionName, file, line, column);
  }

  const anonymous = V8_FRAME_WITHOUT_NAME.exec(text);
  if (anonymous) {
    const [, file, line, column] = anonymous;

    return toFrame("", file, line, column);
  }

  const gecko = GECKO_FRAME.exec(text);
  if (gecko) {
    const [, functionName, file, line, column] = gecko;

    return toFrame(functionName, file, line, column);
  }

  return null;
};

export const parseStackFrames = (stack: string): DevErrorFrame[] =>
  stack.split("\n").flatMap(text => parseLine(text) ?? []);
