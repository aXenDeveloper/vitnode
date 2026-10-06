import { writeFileSync } from "node:fs";
import { relative } from "node:path";

import type { Ui } from "./cli/ui/ui.js";

import { EXIT_CODE } from "./cli/errors.js";
import { getConfig } from "./get-config.js";
import {
  appScope,
  effectiveDefaultTree,
  flattenKeys,
  listAppLocaleFiles,
  noConfigError,
  readJsonTree,
} from "./i18n-shared.js";
import { findRepoRoot } from "./shared/file-utils.js";

const MAX_LISTED_KEYS = 8;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

/**
 * `vitnode i18n update` - brings every translation file in line with the
 * default locale: new keys are seeded in the default language, removed keys
 * are dropped, existing translations are kept.
 */
export const i18nUpdate = async ({
  cwd,
  ui,
}: {
  cwd: string;
  ui: Ui;
}): Promise<number> => {
  const { colors } = ui;
  const green = colors.success;
  const red = colors.error;
  const dim = colors.muted;
  const appDir = cwd;

  const [webConfig, apiConfig] = await Promise.all([
    getConfig({ baseDir: cwd, optional: true }),
    getConfig({ baseDir: cwd, optional: true, type: "api.config" }),
  ]);
  const config = webConfig ?? apiConfig;

  if (!config) throw noConfigError();

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
    ui.note("No translation files to update.");
    ui.line();

    return EXIT_CODE.ok;
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

  ui.note(
    `Syncing ${appFiles.length} translation file(s) against ${defaultLocale}.`,
  );
  ui.line();

  let addedTotal = 0;
  let removedTotal = 0;
  let changed = 0;

  for (const file of appFiles) {
    const location = relative(appDir, file.path);
    const english = englishFor(file.pluginId);

    // No source of truth (package ships nothing for this scope, or is not
    // installed). Reconciling would empty the file, so leave it as it is.
    if (Object.keys(english).length === 0) {
      ui.line(
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
      ui.line(dim(`  ok       ${location}`));
      continue;
    }

    writeFileSync(
      file.path,
      `${JSON.stringify(reconcileTree(english, current), null, 2)}\n`,
    );
    changed += 1;
    addedTotal += added.length;
    removedTotal += removed.length;

    ui.line(
      `${green(`  updated  ${location}`)}  ${dim(`+${added.length} -${removed.length}`)}`,
    );
    for (const key of added.slice(0, MAX_LISTED_KEYS)) {
      ui.line(green(`      + ${key}`));
    }
    for (const key of removed.slice(0, MAX_LISTED_KEYS - added.length)) {
      ui.line(red(`      - ${key}`));
    }
    const shown = Math.min(added.length, MAX_LISTED_KEYS) + removed.length;
    if (added.length + removed.length > shown) {
      ui.line(
        dim(`      ... and ${added.length + removed.length - shown} more`),
      );
    }
  }

  ui.line();

  if (changed === 0) {
    ui.success("Every translation is already in sync.");
    ui.line();

    return EXIT_CODE.ok;
  }

  ui.success(
    `${changed} file(s) updated: +${addedTotal} added, -${removedTotal} removed.`,
  );
  ui.note(
    `Translate the added keys, then run ${colors.command("vitnode i18n check")}.`,
  );
  ui.line();

  return EXIT_CODE.ok;
};
