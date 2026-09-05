/* eslint-disable no-console */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { getConfig } from "./get-config.js";
import { appScope, packageLocaleFiles } from "./i18n-shared.js";
import { findRepoRoot } from "./shared/file-utils.js";

const CORE_PLUGIN_ID = "@vitnode/core";
const MAX_LISTED_KEYS = 8;

const dim = (value: string) => `\x1b[90m${value}\x1b[0m`;
const red = (value: string) => `\x1b[31m${value}\x1b[0m`;
const yellow = (value: string) => `\x1b[33m${value}\x1b[0m`;
const green = (value: string) => `\x1b[32m${value}\x1b[0m`;

/** Flattens a message tree into the dotted leaf paths translators care about. */
const flattenKeys = (value: unknown, prefix = ""): string[] => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, nested]) =>
    flattenKeys(nested, prefix ? `${prefix}.${key}` : key),
  );
};

const readKeys = (filePath: string): null | string[] => {
  if (!existsSync(filePath)) return null;

  try {
    return flattenKeys(JSON.parse(readFileSync(filePath, "utf-8")));
  } catch (error) {
    console.error(red(`  Could not parse ${filePath}: ${String(error)}`));

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

export const i18nCheck = async (flag?: string) => {
  const isCi = flag === "--ci";
  const appDir = process.cwd();
  const repoRoot = findRepoRoot(appDir);

  const webConfig = await getConfig({ optional: true });
  const apiConfig = await getConfig({ optional: true, type: "api.config" });
  // The app's own message loaders live in the server-only config now, because
  // the shared one is browser-safe. Read from both, so an installation still on
  // the old shape - loaders inside `i18n.messages` - is measured correctly.
  const serverConfig = await getConfig({
    optional: true,
    type: "server.config",
  });
  const config = webConfig ?? apiConfig;

  if (!config) {
    console.error(red("No vitnode.config.ts or vitnode.api.config.ts found."));
    process.exit(1);
  }

  // Check against the trees the app actually uses: an API-only app is measured
  // on email strings alone, a single app on both.
  const scope = appScope({ api: apiConfig !== null, web: webConfig !== null });
  const defaultLocale = config.i18n?.defaultLocale ?? "en";
  const declared = (config.i18n?.locales ?? []).map(locale => locale.code);
  const appMessages = serverConfig?.messages ?? config.i18n?.messages ?? {};
  // Web and API plugins differ in everything but the id, which is all we need;
  // union across both configs so an API-only plugin is still checked.
  const pluginIds = [
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
  const locales = [
    ...new Set([...declared, ...appFiles.map(file => file.locale)]),
  ].filter(locale => locale !== defaultLocale);

  console.log(
    `\x1b[34m[VitNode]\x1b[0m Checking ${pluginIds.length} package(s) against ${locales.length || "no"} extra locale(s), default ${dim(defaultLocale)}.`,
  );

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
      .map(readKeys)
      .filter((keys): keys is string[] => keys !== null);
    const override = appFiles.find(
      file => file.pluginId === pluginId && file.locale === locale,
    );
    const fromApp = override ? readKeys(override.path) : null;

    if (fromPackage.length === 0 && !fromApp) return null;

    return [...new Set([...fromPackage.flat(), ...(fromApp ?? [])])];
  };

  for (const pluginId of pluginIds) {
    const baseKeys = keysFor(pluginId, defaultLocale);

    if (!baseKeys) {
      // `packageLocaleFiles` returns paths only when the package resolves, so an
      // empty list means it is genuinely absent. A resolved package with no
      // strings in this scope - e.g. a plugin with no server tree in an
      // API-only app - simply has nothing to translate.
      const installed =
        packageLocaleFiles(pluginId, defaultLocale, { repoRoot, scope })
          .length > 0;

      if (installed) {
        console.log(
          dim(`  ${pluginId}: no strings for this app - nothing to translate`),
        );
      } else {
        console.log(
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
          console.log(
            red(
              `  ${pluginId} · ${locale}: no locale file - create src/locales/${pluginId}/${locale}.json`,
            ),
          );
        } else {
          console.log(
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
        console.log(green(`  ${pluginId} · ${locale}: complete`));
        continue;
      }

      if (missing.length > 0) {
        missingTotal += missing.length;
        problems += 1;
        console.log(
          yellow(
            `  ${pluginId} · ${locale}: ${missing.length} key(s) missing, falling back to ${defaultLocale}`,
          ),
        );
        for (const key of missing.slice(0, MAX_LISTED_KEYS)) {
          console.log(dim(`      ${key}`));
        }
        if (missing.length > MAX_LISTED_KEYS) {
          console.log(
            dim(`      ... and ${missing.length - MAX_LISTED_KEYS} more`),
          );
        }
      }

      if (unknown.length > 0) {
        problems += 1;
        console.log(
          yellow(
            `  ${pluginId} · ${locale}: ${unknown.length} key(s) unknown to ${defaultLocale} - typo or leftover?`,
          ),
        );
        for (const key of unknown.slice(0, MAX_LISTED_KEYS)) {
          console.log(dim(`      ${key}`));
        }
        if (unknown.length > MAX_LISTED_KEYS) {
          console.log(
            dim(`      ... and ${unknown.length - MAX_LISTED_KEYS} more`),
          );
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
      console.log(
        red(
          `  ${location} is never loaded - add \`"${file.pluginId}": () => import("./${file.pluginId}/${file.locale}.json")\` under \`"${file.locale}"\` in \`src/locales/app.ts\`.`,
        ),
      );
    } else if (declared.length > 0 && !declared.includes(file.locale)) {
      errors += 1;
      problems += 1;
      console.log(
        red(`  ${location} uses a locale that is not in \`i18n.locales\`.`),
      );
    }
  }

  if (problems === 0) {
    console.log(green("  Everything is translated. Nice."));
    process.exit(0);
  }

  console.log(
    `\x1b[34m[VitNode]\x1b[0m ${problems} issue(s)` +
      (errors > 0 ? red(`, ${errors} error(s)`) : "") +
      `, ${missingTotal} untranslated key(s).`,
  );

  // Missing/unloadable files always fail; key-level gaps only fail under --ci.
  process.exit(errors > 0 || isCi ? 1 : 0);
};
