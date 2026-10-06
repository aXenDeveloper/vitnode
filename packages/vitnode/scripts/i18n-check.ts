import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import type { Ui } from "./cli/ui/ui.js";

import { EXIT_CODE, ValidationError } from "./cli/errors.js";
import { getConfig } from "./get-config.js";
import {
  appOwnedIds,
  appScope,
  noConfigError,
  packageLocaleFiles,
} from "./i18n-shared.js";
import { findRepoRoot } from "./shared/file-utils.js";

const CORE_PLUGIN_ID = "@vitnode/core";
const MAX_LISTED_KEYS = 8;

/** Flattens a message tree into the dotted leaf paths translators care about. */
const flattenKeys = (value: unknown, prefix = ""): string[] => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, nested]) =>
    flattenKeys(nested, prefix ? `${prefix}.${key}` : key),
  );
};

const readKeys = (
  filePath: string,
  onError: (message: string) => void,
): null | string[] => {
  if (!existsSync(filePath)) return null;

  try {
    return flattenKeys(JSON.parse(readFileSync(filePath, "utf-8")));
  } catch (error) {
    onError(`  Could not parse ${filePath}: ${String(error)}`);

    return [];
  }
};

/** Every `<pluginId>/<locale>.json` the app itself owns. */
const readAppLocaleFiles = (appDir: string) => {
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

/**
 * `vitnode i18n check` - which translations are missing, unknown or never
 * loaded.
 *
 * A missing or unloadable file always fails. Key-level gaps fall back to the
 * default locale at runtime, so they only fail with `ci` - the switch a
 * pipeline uses to hold translations to the same bar as the build.
 */
export const i18nCheck = async ({
  ci = false,
  cwd,
  ui,
}: {
  ci?: boolean;
  cwd: string;
  ui: Ui;
}): Promise<number> => {
  const { colors } = ui;
  const red = colors.error;
  const yellow = colors.warning;
  const green = colors.success;
  const dim = colors.muted;
  const say = (text: string) => {
    ui.line(text);
  };
  const appDir = cwd;
  const repoRoot = findRepoRoot(appDir);

  // The app's own message loaders live in the server-only config now, because
  // the shared one is browser-safe. Read from both, so an installation still on
  // the old shape - loaders inside `i18n.messages` - is measured correctly.
  const [webConfig, apiConfig, serverConfig] = await Promise.all([
    getConfig({ baseDir: cwd, optional: true }),
    getConfig({ baseDir: cwd, optional: true, type: "api.config" }),
    getConfig({ baseDir: cwd, optional: true, type: "server.config" }),
  ]);
  const config = webConfig ?? apiConfig;

  if (!config) throw noConfigError();

  // Check against the trees the app actually uses: an API-only app is measured
  // on email strings alone, a single app on both.
  const scope = appScope({ api: apiConfig !== null, web: webConfig !== null });
  const defaultLocale = config.i18n?.defaultLocale ?? "en";
  const declared = (config.i18n?.locales ?? []).map(locale => locale.code);
  const appMessages = serverConfig?.messages ?? config.i18n?.messages ?? {};
  // Web and API plugins differ in everything but the id, which is all we need;
  // union across both configs so an API-only plugin is still checked.
  const packageIds = [
    ...new Set([
      CORE_PLUGIN_ID,
      ...[webConfig, apiConfig].flatMap(loaded =>
        ((loaded?.plugins ?? []) as { pluginId: string }[]).map(
          plugin => plugin.pluginId,
        ),
      ),
    ]),
  ];

  const appFiles = readAppLocaleFiles(appDir);
  const appIds = new Set(appOwnedIds(appFiles, packageIds));
  const pluginIds = [...packageIds, ...appIds];
  const locales = [
    ...new Set([...declared, ...appFiles.map(file => file.locale)]),
  ].filter(locale => locale !== defaultLocale);

  ui.note(
    `Checking ${packageIds.length} package(s) and ${appIds.size} app namespace(s) against ${locales.length || "no"} extra locale(s), default ${defaultLocale}.`,
  );
  ui.line();

  let missingTotal = 0;
  let problems = 0;
  // Hard errors (a missing or unloadable file) fail the command on their own;
  // softer key-level gaps only fail under `--ci`.
  let errors = 0;
  const declaredLocales = new Set(declared);

  // Keys per (plugin, locale), from the package itself plus the app's overrides.
  // A package ships up to two trees - `locales/<locale>.json` (frontend) and
  // `locales/api/<locale>.json` (server); the known set is the union of the
  // ones this app's scope covers, plus its own override.
  const keysFor = (pluginId: string, locale: string): null | string[] => {
    const fromPackage = packageLocaleFiles(pluginId, locale, {
      repoRoot,
      scope,
    })
      .map(file => readKeys(file, message => say(red(message))))
      .filter((keys): keys is string[] => keys !== null);
    const override = appFiles.find(
      file => file.pluginId === pluginId && file.locale === locale,
    );
    const fromApp = override
      ? readKeys(override.path, message => say(red(message)))
      : null;

    if (fromPackage.length === 0 && !fromApp) return null;

    return [...new Set([...fromPackage.flat(), ...(fromApp ?? [])])];
  };

  for (const pluginId of pluginIds) {
    const baseKeys = keysFor(pluginId, defaultLocale);

    if (!baseKeys && appIds.has(pluginId)) {
      errors += 1;
      problems += 1;
      say(
        red(
          `  ${pluginId}: no "${defaultLocale}" messages - create src/locales/${pluginId}/${defaultLocale}.json, every other language is checked against it`,
        ),
      );
      continue;
    }

    if (!baseKeys) {
      // `packageLocaleFiles` returns paths only when the package resolves, so an
      // empty list means it is genuinely absent. A resolved package with no
      // strings in this scope - e.g. a plugin with no server tree in an
      // API-only app - simply has nothing to translate.
      const installed =
        packageLocaleFiles(pluginId, defaultLocale, { repoRoot, scope })
          .length > 0;

      if (installed) {
        say(
          dim(`  ${pluginId}: no strings for this app - nothing to translate`),
        );
      } else {
        say(
          yellow(
            `  ${pluginId}: no "${defaultLocale}" messages found - is the package installed?`,
          ),
        );
        problems += 1;
      }
      continue;
    }

    for (const locale of locales) {
      const localeKeys = keysFor(pluginId, locale);

      if (!localeKeys) {
        // A declared language with no file for this package is a hard error:
        // create the override (e.g. via `vitnode i18n:create`). An undeclared
        // locale just falls back, so leave it as a note.
        if (declaredLocales.has(locale)) {
          errors += 1;
          problems += 1;
          say(
            red(
              `  ${pluginId} · ${locale}: no locale file - create src/locales/${pluginId}/${locale}.json`,
            ),
          );
        } else {
          say(
            dim(
              `  ${pluginId} · ${locale}: not translated, falls back to ${defaultLocale}`,
            ),
          );
        }
        continue;
      }

      const known = new Set(baseKeys);
      const translated = new Set(localeKeys);
      const missing = baseKeys.filter(key => !translated.has(key));
      const unknown = localeKeys.filter(key => !known.has(key));

      if (missing.length === 0 && unknown.length === 0) {
        say(green(`  ${pluginId} · ${locale}: complete`));
        continue;
      }

      if (missing.length > 0) {
        missingTotal += missing.length;
        problems += 1;
        say(
          yellow(
            `  ${pluginId} · ${locale}: ${missing.length} key(s) missing, falling back to ${defaultLocale}`,
          ),
        );
        for (const key of missing.slice(0, MAX_LISTED_KEYS)) {
          say(dim(`      ${key}`));
        }
        if (missing.length > MAX_LISTED_KEYS) {
          say(dim(`      ... and ${missing.length - MAX_LISTED_KEYS} more`));
        }
      }

      if (unknown.length > 0) {
        problems += 1;
        say(
          yellow(
            `  ${pluginId} · ${locale}: ${unknown.length} key(s) unknown to ${defaultLocale} - typo or leftover?`,
          ),
        );
        for (const key of unknown.slice(0, MAX_LISTED_KEYS)) {
          say(dim(`      ${key}`));
        }
        if (unknown.length > MAX_LISTED_KEYS) {
          say(dim(`      ... and ${unknown.length - MAX_LISTED_KEYS} more`));
        }
      }
    }
  }

  // A file nobody imports is invisible at runtime - the usual reason a
  // translation "does not apply".
  for (const file of appFiles) {
    const wired = appMessages[file.locale]?.[file.pluginId];
    const location = relative(appDir, file.path);

    if (!wired) {
      errors += 1;
      problems += 1;
      say(
        red(
          `  ${location} is never loaded - add \`"${file.pluginId}": () => import("./${file.pluginId}/${file.locale}.json")\` under \`"${file.locale}"\` in \`src/locales/app.ts\`.`,
        ),
      );
    } else if (declared.length > 0 && !declaredLocales.has(file.locale)) {
      errors += 1;
      problems += 1;
      say(red(`  ${location} uses a locale that is not in \`i18n.locales\`.`));
    }
  }

  ui.line();

  if (problems === 0) {
    ui.success("Everything is translated. Nice.");
    ui.line();

    return EXIT_CODE.ok;
  }

  const summary = `${problems} issue(s)${errors > 0 ? `, ${errors} error(s)` : ""}, ${missingTotal} untranslated key(s).`;

  // Missing/unloadable files always fail; key-level gaps only fail under --ci.
  if (errors > 0 || ci) {
    throw new ValidationError(summary, {
      hint:
        errors > 0
          ? undefined
          : "--ci fails on missing keys; without it they only warn, and fall back to the default locale.",
    });
  }

  ui.warning(summary);
  ui.line();

  return EXIT_CODE.ok;
};
