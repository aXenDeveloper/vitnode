/* eslint-disable no-console */
import { writeFileSync } from "node:fs";
import { relative } from "node:path";

import { getConfig } from "./get-config.js";
import {
  appScope,
  dim,
  effectiveDefaultTree,
  flattenKeys,
  green,
  listAppLocaleFiles,
  prefix,
  readJsonTree,
  red,
  yellow,
} from "./i18n-shared.js";
import { findRepoRoot } from "./shared/file-utils.js";

const MAX_LISTED_KEYS = 8;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Reconciles a translation tree against the English source: the result has
 * exactly English's shape, but every leaf keeps the existing translation when
 * there is one and falls back to the English string when there is not.
 *
 * - a key English has but the translation lacks -> added, seeded with English
 * - a key the translation has but English no longer does -> dropped
 * - a key both have -> the existing translation is preserved, never overwritten
 */
export const reconcileTree = (
  english: Record<string, unknown>,
  current: Record<string, unknown>,
): Record<string, unknown> => {
  const merge = (source: unknown, existing: unknown): unknown => {
    if (isPlainObject(source)) {
      const from = isPlainObject(existing) ? existing : {};

      return Object.fromEntries(
        Object.entries(source).map(([key, value]) => [
          key,
          merge(value, from[key]),
        ]),
      );
    }

    // English leaf: keep an existing leaf translation, otherwise seed English.
    return existing !== undefined && !isPlainObject(existing)
      ? existing
      : source;
  };

  return merge(english, current) as Record<string, unknown>;
};

export const i18nUpdate = async () => {
  const appDir = process.cwd();

  const webConfig = await getConfig({ optional: true });
  const apiConfig = await getConfig({ optional: true, type: "api.config" });
  const config = webConfig ?? apiConfig;

  if (!config) {
    console.error(red("No vitnode.config.ts or vitnode.api.config.ts found."));
    process.exit(1);
  }

  const scope = appScope({ api: apiConfig !== null, web: webConfig !== null });
  const defaultLocale = config.i18n?.defaultLocale ?? "en";

  let repoRoot = appDir;
  try {
    repoRoot = findRepoRoot(appDir);
  } catch {
    // Not inside a project root (unusual) - `effectiveDefaultTree` will find
    // nothing and every file is left untouched, which is the safe outcome.
  }

  // Only the app's own overrides get reconciled - the default locale is the
  // source, never a target.
  const appFiles = listAppLocaleFiles(appDir).filter(
    file => file.locale !== defaultLocale,
  );

  if (appFiles.length === 0) {
    console.log(`${prefix} No translation files to update.`);
    process.exit(0);
  }

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

  console.log(
    `${prefix} Syncing ${appFiles.length} translation file(s) against ${dim(defaultLocale)}.`,
  );

  let addedTotal = 0;
  let removedTotal = 0;
  let changed = 0;

  for (const file of appFiles) {
    const location = relative(appDir, file.path);
    const english = englishFor(file.pluginId);

    // No source of truth (package ships nothing for this scope, or is not
    // installed). Reconciling would empty the file, so leave it as it is.
    if (Object.keys(english).length === 0) {
      console.log(
        dim(`  skipped  ${location} - no "${defaultLocale}" source strings`),
      );
      continue;
    }

    const current = readJsonTree(file.path);
    const englishKeys = new Set(flattenKeys(english));
    const currentKeys = new Set(flattenKeys(current));
    const added = [...englishKeys].filter(key => !currentKeys.has(key));
    const removed = [...currentKeys].filter(key => !englishKeys.has(key));

    if (added.length === 0 && removed.length === 0) {
      console.log(dim(`  ok       ${location}`));
      continue;
    }

    writeFileSync(
      file.path,
      `${JSON.stringify(reconcileTree(english, current), null, 2)}\n`,
    );
    changed += 1;
    addedTotal += added.length;
    removedTotal += removed.length;

    console.log(
      `${green(`  updated  ${location}`)}  ${dim(`+${added.length} -${removed.length}`)}`,
    );
    for (const key of added.slice(0, MAX_LISTED_KEYS)) {
      console.log(green(`      + ${key}`));
    }
    for (const key of removed.slice(0, MAX_LISTED_KEYS - added.length)) {
      console.log(red(`      - ${key}`));
    }
    const shown = Math.min(added.length, MAX_LISTED_KEYS) + removed.length;
    if (added.length + removed.length > shown) {
      console.log(
        dim(`      ... and ${added.length + removed.length - shown} more`),
      );
    }
  }

  if (changed === 0) {
    console.log(green("  Every translation is already in sync."));
    process.exit(0);
  }

  console.log(
    `\n${prefix} ${green(`${changed} file(s) updated`)}: ${yellow(`+${addedTotal}`)} added, ${yellow(`-${removedTotal}`)} removed. Translate the added keys, then run vitnode i18n:check.`,
  );
  process.exit(0);
};
