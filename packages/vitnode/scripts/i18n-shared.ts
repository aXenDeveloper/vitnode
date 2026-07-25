/* eslint-disable no-console */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import { deepMerge } from "../src/lib/i18n/deep-merge.js";
import { findPackagePath } from "./shared/file-utils.js";

export const CORE_PLUGIN_ID = "@vitnode/core";

/**
 * Which of a package's two locale trees an app actually uses. A package ships a
 * frontend tree (`src/locales/<locale>.json`) and, if it renders server-side, a
 * server tree (`src/locales/api/<locale>.json`). An app that only runs the API
 * has no use for the frontend's UI copy, so `create` and `check` scope to the
 * trees the app's configs prove it needs.
 */
export interface AppScope {
  api: boolean;
  web: boolean;
}

/**
 * The scope implied by which config files an app has: a `vitnode.config.ts`
 * means it serves the frontend, a `vitnode.api.config.ts` means it runs the
 * API, and a single app has both. An app with neither is treated as both, so
 * the tools stay useful rather than silently seeding nothing.
 */
export const appScope = ({
  api,
  web,
}: {
  api: boolean;
  web: boolean;
}): AppScope => (web || api ? { api, web } : { api: true, web: true });

/**
 * A package's locale files for the trees this app's scope covers - the frontend
 * `<locale>.json`, the server `api/<locale>.json`, or both.
 */
export const packageLocaleFiles = (
  pluginId: string,
  locale: string,
  { repoRoot, scope }: { repoRoot: string; scope: AppScope },
): string[] => {
  const packagePath = findPackagePath(pluginId, repoRoot);
  if (!packagePath) return [];

  const base = join(packagePath, "src", "locales");
  const files: string[] = [];
  if (scope.web) files.push(join(base, `${locale}.json`));
  if (scope.api) files.push(join(base, "api", `${locale}.json`));

  return files;
};

export const readJsonTree = (filePath: string): Record<string, unknown> => {
  if (!existsSync(filePath)) return {};

  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, "utf-8"));

    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

export const flattenKeys = (value: unknown, prefix = ""): string[] => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, nested]) =>
    flattenKeys(nested, prefix ? `${prefix}.${key}` : key),
  );
};

/**
 * The merged default-locale tree used to seed a new override file - only the
 * trees the app's scope covers, so an API-only app is seeded with email strings
 * alone rather than the whole admin UI.
 */
export const packageDefaultTree = (
  pluginId: string,
  {
    locale,
    repoRoot,
    scope,
  }: { locale: string; repoRoot: string; scope: AppScope },
): Record<string, unknown> =>
  packageLocaleFiles(pluginId, locale, { repoRoot, scope })
    .map(readJsonTree)
    .reduce<Record<string, unknown>>((acc, tree) => deepMerge(acc, tree), {});

export const dim = (value: string) => `\x1b[90m${value}\x1b[0m`;
export const red = (value: string) => `\x1b[31m${value}\x1b[0m`;
export const green = (value: string) => `\x1b[32m${value}\x1b[0m`;
export const cyan = (value: string) => `\x1b[36m${value}\x1b[0m`;
export const yellow = (value: string) => `\x1b[33m${value}\x1b[0m`;
export const prefix = "\x1b[34m[VitNode]\x1b[0m";

// `createInterface` is overloaded, which makes `ReturnType<typeof
// createInterface>` resolve to `never`; go through a plain factory instead.
export const createReadline = () => createInterface({ input, output });
export type Readline = ReturnType<typeof createReadline>;

/** Re-prompts until the answer passes `validate` (which returns an error or null). */
export const askQuestion = async (
  rl: Readline,
  question: string,
  validate: (value: string) => null | string,
): Promise<string> => {
  for (;;) {
    const value = (await rl.question(question)).trim();
    const error = validate(value);
    if (error) {
      console.log(red(`  ${error}`));
      continue;
    }

    return value;
  }
};

/** A yes/no prompt that defaults to no. */
export const askConfirm = async (
  rl: Readline,
  question: string,
): Promise<boolean> => {
  const answer = (await rl.question(question)).trim().toLowerCase();

  return answer === "y" || answer === "yes";
};

/**
 * Takes a value from the command line when provided, otherwise prompts for it.
 * A value given inline is validated once and hard-fails; a missing value with
 * no interactive prompt (`rl === null`) hard-fails with `missingMessage`.
 */
export const resolveField = async ({
  missingMessage,
  provided,
  question,
  rl,
  validate,
}: {
  missingMessage: string;
  provided: string | undefined;
  question: string;
  rl: null | Readline;
  validate: (value: string) => null | string;
}): Promise<string> => {
  if (provided !== undefined) {
    const error = validate(provided);
    if (error) {
      console.error(red(error));
      process.exit(1);
    }

    return provided;
  }
  if (!rl) {
    console.error(red(missingMessage));
    process.exit(1);
  }

  return askQuestion(rl, question, validate);
};

/** Finds the source file that declares the app's i18n config, if any. */
export const findI18nSourceFile = (appDir: string): null | string => {
  const srcRoot = join(appDir, "src");
  const preferred = join(srcRoot, "i18n.ts");
  if (existsSync(preferred)) return preferred;

  const skip = new Set(["build", "dist", "node_modules", "out"]);
  const walk = (dir: string, depth: number): null | string => {
    if (depth > 4 || !existsSync(dir)) return null;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || skip.has(entry.name)) continue;
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        const found = walk(full, depth + 1);
        if (found) return found;
      } else if (entry.name.endsWith(".ts")) {
        const content = readFileSync(full, "utf-8");
        if (
          content.includes("defaultLocale") &&
          /locales\s*:\s*\[/.test(content)
        ) {
          return full;
        }
      }
    }

    return null;
  };

  return walk(srcRoot, 0);
};

/** Every `<pluginId>/<locale>.json` the app owns under `src/locales`. */
export const listAppLocaleFiles = (
  appDir: string,
): { locale: string; path: string; pluginId: string }[] => {
  const root = join(appDir, "src", "locales");
  const files: { locale: string; path: string; pluginId: string }[] = [];
  if (!existsSync(root)) return files;

  // Plugin ids are scoped (`@vitnode/core`), so the directory is two levels
  // deep for scoped packages and one for unscoped ones.
  const walk = (dir: string, segments: string[]) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(entryPath, [...segments, entry.name]);
      } else if (entry.name.endsWith(".json") && segments.length > 0) {
        files.push({
          locale: entry.name.replace(/\.json$/, ""),
          path: entryPath,
          pluginId: segments.join("/"),
        });
      }
    }
  };

  walk(root, []);

  return files;
};
