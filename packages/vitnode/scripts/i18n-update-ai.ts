/* eslint-disable no-console */
import { checkbox, select } from "@inquirer/prompts";
import { generateText, type LanguageModel, Output } from "ai";
import { config as loadEnv } from "dotenv";
import { writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { z } from "zod";

import type { AIModelDefinition } from "../src/api/models/ai.js";

import { findConfigFile, getConfig } from "./get-config.js";
import {
  appScope,
  cyan,
  dim,
  effectiveDefaultTree,
  green,
  listAppLocaleFiles,
  prefix,
  readJsonTree,
  red,
  yellow,
} from "./i18n-shared.js";
import { reconcileTree } from "./i18n-update.js";
import { findRepoRoot } from "./shared/file-utils.js";

/** Strings translated per model call. Small enough to stay well within output
 *  limits and keep a single provider hiccup from dropping a whole locale. */
const BATCH_SIZE = 40;

/** Model calls in flight at once. Translation is network-bound - running the
 *  batches concurrently is the main speed-up - and this cap keeps provider rate
 *  limits happy. Overridable with `--concurrency <n>`. */
const DEFAULT_CONCURRENCY = 6;

/** Attempts per batch before it is given up on. At higher concurrency a
 *  transient 429/timeout should not sink the whole run, so each batch retries
 *  with backoff; if it still fails its strings are left in English for next time. */
const MAX_ATTEMPTS = 3;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The provider id string of a configured model - the string itself, or the
 *  `modelId` of a provider instance - shown to the user next to its name. */
const toModelId = (model: LanguageModel): string =>
  typeof model === "string" ? model : model.modelId;

export const isTranslatable = (source: string): boolean => {
  const stripped = source
    .replace(/\{[a-zA-Z0-9_]+\}/g, "")
    .replace(/<[^>]+>/g, "");

  return /\p{L}/u.test(stripped);
};

/** A single string leaf to translate, addressed by its path through the tree. */
export interface TranslatableLeaf {
  path: string[];
  source: string;
}

type AppLocaleFile = ReturnType<typeof listAppLocaleFiles>[number];

/** One file's translation work: its reconciled tree, the leaves still in
 *  English, and where to write it back. */
interface FileJob {
  current: Record<string, unknown>;
  file: AppLocaleFile;
  locale: string;
  location: string;
  reconciled: Record<string, unknown>;
  untranslated: TranslatableLeaf[];
}

/** One batch of unique source strings queued for a single locale. */
interface BatchTask {
  languageName: string;
  locale: string;
  sources: string[];
}

export const collectUntranslated = (
  english: Record<string, unknown>,
  target: Record<string, unknown>,
): TranslatableLeaf[] => {
  const leaves: TranslatableLeaf[] = [];

  const walk = (source: unknown, existing: unknown, path: string[]) => {
    if (isPlainObject(source)) {
      const from = isPlainObject(existing) ? existing : {};
      for (const [key, value] of Object.entries(source)) {
        walk(value, from[key], [...path, key]);
      }

      return;
    }

    if (
      typeof source === "string" &&
      existing === source &&
      isTranslatable(source)
    ) {
      leaves.push({ path, source });
    }
  };

  walk(english, target, []);

  return leaves;
};

export const applyTranslations = (
  tree: Record<string, unknown>,
  entries: { path: string[]; value: string }[],
): Record<string, unknown> => {
  const next = structuredClone(tree);

  for (const { path, value } of entries) {
    if (path.length === 0) continue;

    let node: Record<string, unknown> = next;
    let reachable = true;
    for (let i = 0; i < path.length - 1; i += 1) {
      const child = node[path[i]];
      if (!isPlainObject(child)) {
        reachable = false;
        break;
      }
      node = child;
    }

    if (reachable) node[path[path.length - 1]] = value;
  }

  return next;
};

/** Splits `items` into consecutive slices of at most `size`. */
export const chunk = <T>(items: T[], size: number): T[][] => {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }

  return batches;
};

export const uniqueSources = (leaves: TranslatableLeaf[]): string[] => {
  const seen = new Set<string>();
  const sources: string[] = [];
  for (const leaf of leaves) {
    if (!seen.has(leaf.source)) {
      seen.add(leaf.source);
      sources.push(leaf.source);
    }
  }

  return sources;
};

export const mapPool = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runner = async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  };

  const size = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: size }, async () => runner()));

  return results;
};

/** Retries `fn` up to `MAX_ATTEMPTS` times with exponential backoff, rethrowing
 *  the final error if every attempt fails. */
const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
  }

  throw lastError;
};

const translateBatch = async ({
  code,
  languageName,
  model,
  sources,
}: {
  code: string;
  languageName: string;
  model: LanguageModel;
  sources: string[];
}): Promise<Map<string, string>> => {
  const { output } = await generateText({
    model,
    output: Output.array({ element: z.string() }),
    temperature: 0,
    system: [
      "You are a professional software localization translator.",
      `Translate each string from English into ${languageName} (${code}).`,
      "Input is a JSON array of strings. Return a JSON array of the same length, in the same order - one translation per input string, and nothing else.",
      "Preserve placeholders verbatim: {name}, {count}, ICU plurals such as {count, plural, one {#} other {#}}, and tags such as <b></b>. Never rename or reorder them.",
      "Keep the original whitespace and punctuation. Don't translate brand names, code, URLs, or identifiers. Write natural, concise UI copy.",
    ].join("\n"),
    prompt: JSON.stringify(sources),
  });

  if (output.length !== sources.length) {
    throw new Error(
      `expected ${sources.length} translations, got ${output.length}`,
    );
  }

  const result = new Map<string, string>();
  sources.forEach((source, index) => {
    result.set(source, output[index]);
  });

  return result;
};

export const i18nUpdateAi = async () => {
  const appDir = process.cwd();

  // Both configs describe the app's shape; the AI models come from the API
  // config specifically, since AI is configured there (`ai.models`).
  const webConfig = await getConfig({ optional: true });
  const apiConfig = await getConfig({ optional: true, type: "api.config" });
  const config = webConfig ?? apiConfig;

  if (!config) {
    console.error(red("No vitnode.config.ts or vitnode.api.config.ts found."));
    process.exit(1);
  }

  // The AI models live in the API config. In a monorepo the API app is usually
  // a sibling of the app you run this from (e.g. `apps/web` next to `apps/api`),
  // so its `ai.models` are not in this app's tree at all. When the local config
  // has none, look one directory up - across the sibling apps - for a config
  // that does. Only the models are borrowed: `scope` stays tied to the local
  // configs below, so a web app is never suddenly reconciled against the API's
  // server/email strings just because a sibling API app exists.
  let models = apiConfig?.ai?.models ?? [];
  if (models.length === 0) {
    const parent = dirname(appDir);
    const siblingConfigPath =
      parent !== appDir
        ? findConfigFile(parent, "vitnode.api.config.ts")
        : null;

    if (siblingConfigPath) {
      const siblingApiConfig = await getConfig({
        baseDir: parent,
        optional: true,
        type: "api.config",
      });
      models = siblingApiConfig?.ai?.models ?? [];

      // The provider credentials (e.g. `GOOGLE_GENERATIVE_AI_API_KEY`,
      // `AI_GATEWAY_API_KEY`) live next to the borrowed config, not in this app.
      // `scripts.ts` only loaded this app's `.env`, so pull in the API app's too
      // - the models read their keys lazily at request time, so this lands
      // before any translation call. dotenv won't override vars this app already
      // set. The config sits at `<appDir>/src/<file>`, so strip `src/<file>`.
      if (models.length > 0) {
        const siblingAppDir = dirname(dirname(siblingConfigPath));
        loadEnv({ path: join(siblingAppDir, ".env"), quiet: true });
      }
    }
  }

  if (models.length === 0) {
    console.error(
      red(
        "No AI models configured. Add an `ai.models` entry to vitnode.api.config.ts (searched this app and one level up).",
      ),
    );
    process.exit(1);
  }

  const scope = appScope({ api: apiConfig !== null, web: webConfig !== null });
  const defaultLocale = config.i18n?.defaultLocale ?? "en";
  const localeNames = new Map(
    (config.i18n?.locales ?? []).map(locale => [locale.code, locale.name]),
  );

  let repoRoot = appDir;
  try {
    repoRoot = findRepoRoot(appDir);
  } catch {
    // Not inside a project root (unusual) - `effectiveDefaultTree` finds no
    // source strings and every file is left untouched, the safe outcome.
  }

  // Only the app's own overrides are translated - the default locale is the
  // English source, never a target.
  const appFiles = listAppLocaleFiles(appDir).filter(
    file => file.locale !== defaultLocale,
  );

  if (appFiles.length === 0) {
    console.log(
      `${prefix} No translation files to translate. Run ${cyan("vitnode i18n:create")} first.`,
    );
    process.exit(0);
  }

  const byLocale = new Map<string, typeof appFiles>();
  for (const file of appFiles) {
    const list = byLocale.get(file.locale) ?? [];
    list.push(file);
    byLocale.set(file.locale, list);
  }
  const locales = [...byLocale.keys()].sort((a, b) => a.localeCompare(b));

  // `vitnode i18n:update:ai [code...] [--model <id>]` - anything supplied on the
  // command line skips its prompt, so the command is scriptable and never blocks
  // on a non-interactive stdin.
  const rawArgs = process.argv.slice(3);
  let argModelId: string | undefined;
  let argConcurrency: number | undefined;
  const argLocales: string[] = [];
  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === "--model") {
      argModelId = rawArgs[i + 1];
      i += 1;
    } else if (arg.startsWith("--model=")) {
      argModelId = arg.slice("--model=".length);
    } else if (arg === "--concurrency") {
      argConcurrency = Number(rawArgs[i + 1]);
      i += 1;
    } else if (arg.startsWith("--concurrency=")) {
      argConcurrency = Number(arg.slice("--concurrency=".length));
    } else {
      argLocales.push(...arg.split(/[\s,]+/).filter(Boolean));
    }
  }

  const concurrency =
    argConcurrency && Number.isInteger(argConcurrency) && argConcurrency > 0
      ? argConcurrency
      : DEFAULT_CONCURRENCY;

  const isInteractive = process.stdin.isTTY ?? false;

  let selectedLocales: string[];
  let selectedModel: AIModelDefinition;
  try {
    // 1. Which languages to translate from English - a multi-select ticked in
    //    full, so pressing Enter takes them all.
    if (argLocales.length > 0) {
      const unknown = argLocales.filter(code => !byLocale.has(code));
      if (unknown.length > 0) {
        console.error(red(`No translation files for: ${unknown.join(", ")}.`));
        process.exit(1);
      }
      selectedLocales = [...new Set(argLocales)];
    } else if (isInteractive) {
      selectedLocales = await checkbox({
        choices: locales.map(code => ({
          checked: true,
          name: `${localeNames.get(code) ?? code} ${dim(`(${code})`)}`,
          value: code,
        })),
        message: "Which languages should be translated from English?",
        required: true,
      });
    } else {
      console.error(
        red(
          "Missing languages. Run: vitnode i18n:update:ai <code...> [--model <id>]",
        ),
      );
      process.exit(1);
    }

    // 2. Which model to translate with - a single-select defaulting to the
    //    first entry, the default model.
    if (argModelId !== undefined) {
      const found = models.find(entry => entry.id === argModelId);
      if (!found) {
        console.error(
          red(
            `AI model "${argModelId}" is not defined in vitnode.api.config.ts.`,
          ),
        );
        process.exit(1);
      }
      selectedModel = found;
    } else if (isInteractive) {
      const modelId = await select({
        choices: models.map(entry => ({
          name: `${entry.name} ${dim(toModelId(entry.model))}`,
          value: entry.id,
        })),
        default: models[0].id,
        message:
          "Which AI model should translate? (from vitnode.api.config.ts)",
      });
      // `select` only ever returns an id we passed in, so this always resolves.
      selectedModel = models.find(entry => entry.id === modelId) ?? models[0];
    } else {
      // Non-interactive with no `--model`: fall back to the default (first).
      selectedModel = models[0];
    }
  } catch (error) {
    // Ctrl+C / Esc out of a prompt: exit quietly rather than dump a stack trace.
    if (error instanceof Error && error.name === "ExitPromptError") {
      console.log(dim("\nCancelled."));
      process.exit(0);
    }
    throw error;
  }

  if (selectedLocales.length === 0) {
    console.log(`${prefix} No languages selected.`);
    process.exit(0);
  }

  console.log(
    `\n${prefix} Translating with ${green(selectedModel.name)} ${dim(`(${toModelId(selectedModel.model)})`)} into: ${selectedLocales.map(code => cyan(code)).join(", ")}\n`,
  );

  // The English tree per package is the same for every locale, so cache it.
  const englishCache = new Map<string, Record<string, unknown>>();
  const englishFor = (pluginId: string): Record<string, unknown> => {
    const cached = englishCache.get(pluginId);
    if (cached) return cached;

    const tree = effectiveDefaultTree(pluginId, {
      appDir,
      defaultLocale,
      repoRoot,
      scope,
    });
    englishCache.set(pluginId, tree);

    return tree;
  };

  // 1. One job per (locale, file): reconcile against English and collect the
  //    leaves still in English.
  const jobs: FileJob[] = [];
  for (const locale of selectedLocales) {
    for (const file of byLocale.get(locale) ?? []) {
      const location = relative(appDir, file.path);
      const english = englishFor(file.pluginId);

      // No source of truth (package ships nothing for this scope, or is not
      // installed). Translating nothing would be misleading, so skip it.
      if (Object.keys(english).length === 0) {
        console.log(
          dim(`  skipped  ${location} - no "${defaultLocale}" source strings`),
        );
        continue;
      }

      const current = readJsonTree(file.path);
      const reconciled = reconcileTree(english, current);
      jobs.push({
        current,
        file,
        locale,
        location,
        reconciled,
        untranslated: collectUntranslated(english, reconciled),
      });
    }
  }

  // 2. Dedup each locale's leaves into unique sources and cut uniform batches
  //    across every locale into one work list for the pool.
  const tasks: BatchTask[] = [];
  for (const locale of selectedLocales) {
    const leaves = jobs
      .filter(job => job.locale === locale)
      .flatMap(job => job.untranslated);
    const sources = uniqueSources(leaves);
    if (sources.length === 0) continue;

    const languageName = localeNames.get(locale) ?? locale;
    for (const batch of chunk(sources, BATCH_SIZE)) {
      tasks.push({ languageName, locale, sources: batch });
    }
    console.log(
      `  ${cyan(locale)}  ${leaves.length} string(s)${leaves.length === sources.length ? "" : dim(` (${sources.length} unique)`)}`,
    );
  }

  // 3. Translate every batch through a bounded pool - locale -> source -> value.
  const translationsByLocale = new Map<string, Map<string, string>>();
  const failures: unknown[] = [];

  if (tasks.length > 0) {
    const totalSources = tasks.reduce(
      (sum, task) => sum + task.sources.length,
      0,
    );
    console.log(
      dim(
        `  ${totalSources} unique string(s) in ${tasks.length} batch(es), up to ${Math.min(concurrency, tasks.length)} in parallel\n`,
      ),
    );

    let done = 0;
    const results = await mapPool(tasks, concurrency, async task => {
      let translations = new Map<string, string>();
      let error: unknown;
      try {
        translations = await withRetry(async () =>
          translateBatch({
            code: task.locale,
            languageName: task.languageName,
            model: selectedModel.model,
            sources: task.sources,
          }),
        );
      } catch (batchError) {
        error = batchError;
      }
      done += 1;
      process.stdout.write(
        `\r  ${dim(`translated ${done}/${tasks.length} batch(es)`)}`,
      );

      return { error, locale: task.locale, translations };
    });
    process.stdout.write("\n\n");

    for (const result of results) {
      const map =
        translationsByLocale.get(result.locale) ?? new Map<string, string>();
      for (const [source, value] of result.translations) map.set(source, value);
      translationsByLocale.set(result.locale, map);
      if (result.error) failures.push(result.error);
    }
  }

  // 4. Apply each locale's translations to its files, keeping the reconciled
  //    shape, and write only what changed.
  let filesChanged = 0;
  let translatedTotal = 0;
  let notTranslated = 0;

  for (const job of jobs) {
    const localeMap = translationsByLocale.get(job.locale);
    const entries = job.untranslated.flatMap(leaf => {
      const value = localeMap?.get(leaf.source);

      return value === undefined ? [] : [{ path: leaf.path, value }];
    });
    const updated = applyTranslations(job.reconciled, entries);

    if (JSON.stringify(job.current) !== JSON.stringify(updated)) {
      writeFileSync(job.file.path, `${JSON.stringify(updated, null, 2)}\n`);
      filesChanged += 1;
      translatedTotal += entries.length;
      console.log(
        entries.length === 0
          ? `${green(`  synced   ${job.location}`)} ${dim("(structure only)")}`
          : `${green(`  updated  ${job.location}`)} ${dim(`→ ${job.locale}  +${entries.length}`)}`,
      );
    } else {
      console.log(dim(`  ok       ${job.location}`));
    }
    notTranslated += job.untranslated.length - entries.length;
  }

  // 5. Surface any batches that never succeeded - their strings stay in English
  //    for a re-run - rather than failing the whole command.
  if (failures.length > 0) {
    const first = failures[0];
    console.log(
      `\n${prefix} ${yellow(`${failures.length} batch(es) failed`)} after ${MAX_ATTEMPTS} attempts - ${notTranslated} string(s) left in English.`,
    );
    console.log(
      red(`    ${first instanceof Error ? first.message : String(first)}`),
    );
    console.log(
      dim(
        "    Check your AI provider credentials (e.g. AI_GATEWAY_API_KEY) or rate limits, then re-run to fill the rest.",
      ),
    );
  }

  if (filesChanged === 0 && failures.length === 0) {
    console.log(green("\n  Everything is already translated."));
    process.exit(0);
  }

  if (filesChanged > 0) {
    console.log(
      `\n${prefix} ${green(`${filesChanged} file(s) updated`)}, ${yellow(String(translatedTotal))} string(s) translated.`,
    );
  }

  process.exit(failures.length > 0 ? 1 : 0);
};
