import type { Dirent } from "fs";

import { readdir, readFile, writeFile } from "fs/promises";
import { basename, dirname, join } from "path";

import type { PackageJSON } from "../../helpers/packages-json.js";

import {
  pluginApiVariableName,
  pluginVariableName,
} from "./route-templates.js";

export type RegisterPluginStatus =
  "already-registered" | "no-config-call" | "no-plugins-array" | "registered";

export interface RegisterPluginResult {
  source: string;
  status: RegisterPluginStatus;
}

interface RegisterPluginArgs {
  builder: string;
  factory: string;
  module: string;
}

interface ImportStatement {
  end: number;
  isType: boolean;
  specifier: string;
  start: number;
  text: string;
}

const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".nitro",
  ".output",
  ".turbo",
  ".vercel",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);

const CONFIG_BUILDERS: Record<string, { builder: string; subpath: string }> = {
  "vitnode.api.config.ts": {
    builder: "buildApiConfig",
    subpath: "config.api",
  },
  "vitnode.config.ts": { builder: "buildConfig", subpath: "config" },
};

const endOfStringLiteral = (source: string, start: number): number => {
  const quote = source[start];
  let index = start + 1;

  while (index < source.length) {
    const char = source[index];

    if (char === "\\") {
      index += 2;
      continue;
    }

    if (char === quote) return index + 1;

    index += 1;
  }

  return source.length;
};

const closingBracketOf = (source: string, open: number): number => {
  let depth = 0;
  let index = open;

  while (index < source.length) {
    const char = source[index];

    if (char === "/" && source[index + 1] === "/") {
      const newline = source.indexOf("\n", index);
      index = newline === -1 ? source.length : newline;
      continue;
    }

    if (char === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      index = endOfStringLiteral(source, index);
      continue;
    }

    if (char === "[" || char === "(" || char === "{") {
      depth += 1;
    } else if (char === "]" || char === ")" || char === "}") {
      depth -= 1;

      if (depth === 0) return char === "]" ? index : -1;
    }

    index += 1;
  }

  return -1;
};

const endOfComment = (source: string, index: number): number => {
  if (source[index] !== "/") return index;

  if (source[index + 1] === "/") {
    const newline = source.indexOf("\n", index);

    return newline === -1 ? source.length : newline;
  }

  if (source[index + 1] === "*") {
    const end = source.indexOf("*/", index + 2);

    return end === -1 ? source.length : end + 2;
  }

  return index;
};

type PluginsArrayScan =
  | { close: number; kind: "found"; open: number }
  | { kind: "no-config-call" }
  | { kind: "no-plugins-array" };

const findPluginsArray = (
  source: string,
  builder: string,
): PluginsArrayScan => {
  const call = new RegExp(String.raw`(?<![$\w])${builder}\s*\(`, "y");
  const key = /(?<![$\w])(?:plugins|"plugins"|'plugins')\s*:\s*\[/y;
  let depth = 0;
  let index = 0;
  let entered = false;

  while (index < source.length) {
    const char = source[index];
    const afterComment = endOfComment(source, index);

    if (afterComment !== index) {
      index = afterComment;
      continue;
    }

    if (!entered) {
      call.lastIndex = index;
      const match = call.exec(source);

      if (match) {
        entered = true;
        depth = 1;
        index += match[0].length;
        continue;
      }
    } else if (depth === 2) {
      key.lastIndex = index;
      const match = key.exec(source);

      if (match) {
        const open = index + match[0].length - 1;
        const close = closingBracketOf(source, open);

        return close === -1
          ? { kind: "no-plugins-array" }
          : { close, kind: "found", open };
      }
    }

    if (char === '"' || char === "'" || char === "`") {
      index = endOfStringLiteral(source, index);
      continue;
    }

    if (entered) {
      if (char === "[" || char === "(" || char === "{") {
        depth += 1;
      } else if (char === "]" || char === ")" || char === "}") {
        depth -= 1;

        if (depth === 0) return { kind: "no-plugins-array" };
      }
    }

    index += 1;
  }

  return entered ? { kind: "no-plugins-array" } : { kind: "no-config-call" };
};

const readImports = (source: string): ImportStatement[] => {
  const statements: ImportStatement[] = [];
  let offset = 0;
  let open: null | { isType: boolean; start: number } = null;

  for (const line of source.split("\n")) {
    const lineStart = offset;
    offset += line.length + 1;

    open ??= /^import\b/.test(line)
      ? { isType: /^import\s+type\b/.test(line), start: lineStart }
      : null;

    if (!open) continue;

    const specifier =
      /\bfrom\s+['"]([^'"]+)['"]/.exec(line)?.[1] ??
      /^import\s+['"]([^'"]+)['"]/.exec(line)?.[1];

    if (specifier === undefined) continue;

    const end = lineStart + line.length;

    statements.push({
      end,
      isType: open.isType,
      specifier,
      start: open.start,
      text: source.slice(open.start, end),
    });
    open = null;
  }

  return statements;
};

const importStyleOf = (
  source: string,
): { quote: string; semicolon: string } => {
  const match = /\bfrom\s+(['"])[^'"\n]+\1(;?)/.exec(source);

  return { quote: match?.[1] ?? '"', semicolon: match?.[2] ?? ";" };
};

const withImport = (
  source: string,
  { factory, module }: { factory: string; module: string },
): string => {
  const { quote, semicolon } = importStyleOf(source);
  const statement = `import { ${factory} } from ${quote}${module}${quote}${semicolon}`;
  const imports = readImports(source);

  if (imports.length === 0) {
    return `${statement}\n\n${source}`;
  }

  const before = imports.find(
    entry => !entry.isType && entry.specifier > module,
  );

  if (before) {
    return `${source.slice(0, before.start)}${statement}\n${source.slice(before.start)}`;
  }

  const last = imports[imports.length - 1];

  return `${source.slice(0, last.end)}\n${statement}${source.slice(last.end)}`;
};

const endOfLastCode = (source: string): number => {
  let index = 0;
  let last = 0;

  while (index < source.length) {
    const char = source[index];
    const afterComment = endOfComment(source, index);

    if (afterComment !== index) {
      index = afterComment;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      index = endOfStringLiteral(source, index);
      last = index;
      continue;
    }

    if (!/\s/.test(char)) last = index + 1;

    index += 1;
  }

  return last;
};

const withEntry = (
  source: string,
  { close, open }: { close: number; open: number },
  call: string,
): string => {
  const body = source.slice(open + 1, close);
  const head = source.slice(0, open + 1);
  const tail = source.slice(close);

  if (body.trim() === "") {
    if (!body.includes("\n")) return `${head}${call}${tail}`;

    const indent = /\n([ \t]*)$/.exec(body)?.[1] ?? "";

    return `${head}\n${indent}  ${call},${body}${tail}`;
  }

  if (!body.includes("\n")) {
    const separator = body.trimEnd().endsWith(",") ? " " : ", ";

    return `${head}${body}${separator}${call}${tail}`;
  }

  const entries = body.slice(0, endOfLastCode(body));
  const after = body.slice(entries.length);
  const comments = after.replace(/\s+$/, "");
  const trailing = after.slice(comments.length);
  const indent =
    /^[ \t]*(?=\S)/m.exec(body.slice(body.indexOf("\n") + 1))?.[0] ?? "  ";
  const comma = entries.endsWith(",") ? "" : ",";

  return `${head}${entries}${comma}${comments}\n${indent}${call},${trailing}${tail}`;
};

export const registerPluginInSource = (
  source: string,
  { builder, factory, module }: RegisterPluginArgs,
): RegisterPluginResult => {
  const range = findPluginsArray(source, builder);
  if (range.kind !== "found") return { source, status: range.kind };

  const called = new RegExp(`\\b${factory}\\s*\\(`);
  const hasEntry = called.test(source.slice(range.open + 1, range.close));
  const hasImport = readImports(source).some(
    entry =>
      entry.specifier === module &&
      new RegExp(`\\b${factory}\\b`).test(entry.text),
  );

  if (hasEntry && hasImport) return { source, status: "already-registered" };

  const withCall = hasEntry ? source : withEntry(source, range, `${factory}()`);

  return {
    source: hasImport ? withCall : withImport(withCall, { factory, module }),
    status: "registered",
  };
};

export interface PluginConfigRegistration {
  file: string;
  status: RegisterPluginStatus;
}

export const needsManualRegistration = (
  registrations: PluginConfigRegistration[],
): PluginConfigRegistration[] =>
  registrations.filter(
    ({ status }) => status !== "already-registered" && status !== "registered",
  );

const readEntries = async (dir: string): Promise<Dirent[]> => {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
};

const findConfigFiles = async (
  dir: string,
  skipDir: string,
  results: string[] = [],
): Promise<string[]> => {
  for (const entry of await readEntries(dir)) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name) || fullPath === skipDir) continue;

      await findConfigFiles(fullPath, skipDir, results);
      continue;
    }

    if (entry.isFile() && CONFIG_BUILDERS[entry.name]) {
      results.push(fullPath);
    }
  }

  return results;
};

const ownedByVitNodePackage = async (
  file: string,
  rootPath: string,
): Promise<boolean> => {
  let current = dirname(file);

  while (current.startsWith(rootPath)) {
    try {
      const pkg: PackageJSON = JSON.parse(
        await readFile(join(current, "package.json"), "utf-8"),
      );

      return Boolean(
        pkg.dependencies?.["@vitnode/core"] ??
        pkg.devDependencies?.["@vitnode/core"],
      );
    } catch {
      const parent = dirname(current);

      if (parent === current) return false;
      current = parent;
    }
  }

  return false;
};

export const addPluginToConfig = async ({
  pluginName,
  pluginPath,
  rootPath,
}: {
  pluginName: string;
  pluginPath: string;
  rootPath: string;
}): Promise<PluginConfigRegistration[]> => {
  const files = await findConfigFiles(rootPath, pluginPath);
  const registrations: PluginConfigRegistration[] = [];

  for (const file of files.sort()) {
    if (!(await ownedByVitNodePackage(file, rootPath))) continue;

    const target = CONFIG_BUILDERS[basename(file)];
    const isApi = target.subpath === "config.api";

    try {
      const source = await readFile(file, "utf-8");
      const { source: next, status } = registerPluginInSource(source, {
        builder: target.builder,
        factory: isApi
          ? pluginApiVariableName(pluginName)
          : pluginVariableName(pluginName),
        module: `${pluginName}/${target.subpath}`,
      });

      if (status === "registered") {
        await writeFile(file, next, "utf-8");
      }

      registrations.push({ file, status });
    } catch {
      continue;
    }
  }

  return registrations;
};
