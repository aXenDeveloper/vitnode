/* eslint-disable no-console */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { getConfig } from "./get-config.js";
import { findPackagePath, findRepoRoot } from "./shared/file-utils.js";

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
  const config =
    webConfig ?? (await getConfig({ optional: true, type: "api.config" }));

  if (!config) {
    console.error(red("No vitnode.config.ts or vitnode.api.config.ts found."));
    process.exit(1);
  }

  const defaultLocale = config.i18n?.defaultLocale ?? "en";
  const declared = (config.i18n?.locales ?? []).map(locale => locale.code);
  const appMessages = config.i18n?.messages ?? {};
  // Web and API plugins differ in everything but the id, which is all we need.
  const plugins = config.plugins as { pluginId: string }[];
  const pluginIds = [CORE_PLUGIN_ID, ...plugins.map(plugin => plugin.pluginId)];

  const appFiles = readAppLocaleFiles(appDir);
  const locales = [
    ...new Set([...declared, ...appFiles.map(file => file.locale)]),
  ].filter(locale => locale !== defaultLocale);

  console.log(
    `\x1b[34m[VitNode]\x1b[0m Checking ${pluginIds.length} package(s) against ${locales.length || "no"} extra locale(s), default ${dim(defaultLocale)}.`,
  );

  let missingTotal = 0;
  let problems = 0;

  // Keys per (plugin, locale), from the package itself plus the app's overrides.
  const keysFor = (pluginId: string, locale: string): null | string[] => {
    const packagePath = findPackagePath(pluginId, repoRoot);
    const fromPackage = packagePath
      ? readKeys(join(packagePath, "src", "locales", `${locale}.json`))
      : null;
    const override = appFiles.find(
      file => file.pluginId === pluginId && file.locale === locale,
    );
    const fromApp = override ? readKeys(override.path) : null;

    if (!fromPackage && !fromApp) return null;

    return [...new Set([...(fromPackage ?? []), ...(fromApp ?? [])])];
  };

  for (const pluginId of pluginIds) {
    const baseKeys = keysFor(pluginId, defaultLocale);

    if (!baseKeys) {
      console.log(
        yellow(
          `  ${pluginId}: no "${defaultLocale}" messages found - is the package installed?`,
        ),
      );
      problems += 1;
      continue;
    }

    for (const locale of locales) {
      const localeKeys = keysFor(pluginId, locale);

      if (!localeKeys) {
        console.log(
          dim(
            `  ${pluginId} · ${locale}: not translated, falls back to ${defaultLocale}`,
          ),
        );
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
      problems += 1;
      console.log(
        red(
          `  ${location} is never loaded - add \`"${file.pluginId}": () => import("./locales/${file.pluginId}/${file.locale}.json")\` under \`i18n.messages.${file.locale}\`.`,
        ),
      );
    } else if (declared.length > 0 && !declared.includes(file.locale)) {
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
    `\x1b[34m[VitNode]\x1b[0m ${problems} issue(s), ${missingTotal} untranslated key(s).`,
  );

  process.exit(isCi ? 1 : 0);
};
