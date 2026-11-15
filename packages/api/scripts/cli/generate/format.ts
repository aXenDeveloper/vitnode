import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { FileChange, GenerationPlan } from "./plan";

import { errorMessage } from "../errors";

type FormatFn = (
  fileName: string,
  source: string,
  options?: Record<string, unknown>,
) => Promise<{ code: string; errors: unknown[] }>;

const CONFIG_FILES = [
  "oxfmt.config.ts",
  "oxfmt.config.mts",
  "oxfmt.config.js",
  "oxfmt.config.mjs",
  ".oxfmtrc.json",
];

const findConfig = (from: string): null | string => {
  let current = resolve(from);

  for (;;) {
    const found = CONFIG_FILES.map(file => join(current, file)).find(file =>
      existsSync(file),
    );
    if (found !== undefined) return found;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

const loadConfig = async (file: string): Promise<Record<string, unknown>> => {
  if (file.endsWith(".json")) {
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  }

  const { createJiti } = await import("jiti");
  const loaded = await createJiti(pathToFileURL(file).href).import<{
    default?: Record<string, unknown>;
  }>(file);

  return loaded.default ?? {};
};

export interface FormatOutcome {
  skipped?: string;
}

export const formatPlan = async (
  plan: GenerationPlan,
  changes: readonly FileChange[],
): Promise<FormatOutcome> => {
  let format: FormatFn;
  let options: Record<string, unknown> = {};

  try {
    const oxfmtPath = createRequire(join(plan.root, "package.json")).resolve(
      "oxfmt",
    );
    ({ format } = (await import(pathToFileURL(oxfmtPath).href)) as {
      format: FormatFn;
    });
  } catch {
    return { skipped: "oxfmt is not installed in this project" };
  }

  const configFile = findConfig(plan.root);
  if (configFile !== null) {
    try {
      const { ignorePatterns: _ignored, ...rest } =
        await loadConfig(configFile);
      options = rest;
    } catch (error) {
      return {
        skipped: `the oxfmt config could not be loaded (${errorMessage(error).split("\n")[0] ?? ""})`,
      };
    }
  }

  for (const change of changes) {
    if (!/\.(?:ts|tsx|mts|cts|js|mjs)$/.test(change.path)) continue;

    if (change.before !== null) {
      const original = await format(change.path, change.before, options);
      if (original.errors.length > 0 || original.code !== change.before) {
        continue;
      }
    }

    const formatted = await format(change.path, change.after, options);
    if (formatted.errors.length === 0) {
      plan.replaceContent(change.path, formatted.code);
    }
  }

  return {};
};
