import type { ResolvedPackageMessagesModule } from "./types.js";

import { CORE_PLUGIN_ID } from "./core.js";

export const PACKAGE_MESSAGES_ERROR_PREFIX = "[VitNode package messages]";

/** `en`, `pt-BR`, `zh_Hans` - a code, not a path and not an expression. */
const LOCALE_CODE_PATTERN = /^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$/;

/**
 * A bare package specifier with a subpath ending in `.json`.
 *
 * Bare because the app is what imports it: a relative path would be relative to
 * the plugin's own build output, which is the whole reason the plugin's locale
 * barrel cannot be used here.
 */
const LOCALE_FILE_PATTERN =
  /^(?:@[A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9._-]+)+\.json$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasTraversalSegment = (specifier: string): boolean =>
  specifier.split("/").some(segment => segment === "." || segment === "..");

const byKey = (a: string, b: string): number => (a === b ? 0 : a < b ? -1 : 1);

/**
 * One plugin's `localeFiles`, validated, or `undefined` when it declares none.
 *
 * An absent manifest is not an error - most plugins ship no translations, and a
 * build that failed over one would make `localeFiles` mandatory in all but name.
 * An empty one is treated the same way: there is nothing to load either way, and
 * the alternative is an entry in the generated file that says so at length.
 *
 * Everything else is: a manifest that is present and wrong is a translation an
 * author expects to be loaded and that silently would not be.
 */
export const localeFilesFromDeclaration = (
  value: unknown,
  where: string,
): Record<string, string> | undefined => {
  if (value === undefined) return undefined;

  if (!isRecord(value)) {
    throw new Error(
      `${PACKAGE_MESSAGES_ERROR_PREFIX} ${where} is not an object. \`localeFiles\` maps a locale code to the \`*.json\` specifier that locale's messages live at, as in \`{ en: "@acme/blog/locales/en.json" }\`.`,
    );
  }

  const entries = Object.entries(value);
  if (entries.length === 0) return undefined;

  const seen = new Map<string, string>();
  const localeFiles: Record<string, string> = {};

  for (const [code, specifier] of [...entries].sort((a, b) =>
    byKey(a[0], b[0]),
  )) {
    if (!LOCALE_CODE_PATTERN.test(code)) {
      throw new Error(
        `${PACKAGE_MESSAGES_ERROR_PREFIX} ${where} declares ${JSON.stringify(code)}, which is not a locale code.`,
      );
    }

    // A locale is looked up by the code the app asked for, so two keys that
    // differ only in case are two files racing for one lookup - and which of
    // them a merged tree ends up holding is not something an author declared.
    const clash = seen.get(code.toLowerCase());
    if (clash !== undefined) {
      throw new Error(
        `${PACKAGE_MESSAGES_ERROR_PREFIX} ${where} declares the locale ${JSON.stringify(code)} twice, as ${JSON.stringify(clash)} and ${JSON.stringify(code)}. A locale code is matched case-insensitively, so one of the two files would never be loaded.`,
      );
    }
    seen.set(code.toLowerCase(), code);

    if (typeof specifier !== "string") {
      throw new Error(
        `${PACKAGE_MESSAGES_ERROR_PREFIX} ${where}.${code} is not a string. It has to be a literal specifier - \`"@acme/blog/locales/${code}.json"\` - because an app's bundler resolves it at build time.`,
      );
    }

    if (
      !LOCALE_FILE_PATTERN.test(specifier) ||
      hasTraversalSegment(specifier)
    ) {
      throw new Error(
        `${PACKAGE_MESSAGES_ERROR_PREFIX} ${where}.${code} is ${JSON.stringify(specifier)}, which is not a package's \`*.json\` subpath. Declare the path the package exports, as in \`"@acme/blog/locales/${code}.json"\` - a relative path would resolve against the plugin's own build output rather than the app's.`,
      );
    }

    localeFiles[code] = specifier;
  }

  return localeFiles;
};

/** One configured plugin, as much of it as this generator reads. */
export interface PackageMessagesSource {
  localeFiles?: Record<string, string>;
  pluginId: string;
}

/**
 * The plugins that contribute translations, sorted by id and checked for the
 * two collisions that would otherwise resolve by overwriting something.
 *
 * Uniqueness is asserted over the whole configured list rather than over the
 * plugins that survive the filter: two registrations of one plugin is a mistake
 * whether or not either half ships a locale file, and this is the pass that
 * sees all of them.
 */
export const resolvePackageMessagesModules = (
  plugins: readonly PackageMessagesSource[],
  source: string,
): ResolvedPackageMessagesModule[] => {
  const seen = new Set<string>();

  for (const { pluginId } of plugins) {
    if (pluginId === CORE_PLUGIN_ID) {
      throw new Error(
        `${PACKAGE_MESSAGES_ERROR_PREFIX} A plugin configured in ${source} claims the id ${JSON.stringify(CORE_PLUGIN_ID)}, which is core's own. Core's locale files are registered by VitNode itself, so the plugin's would silently replace them.`,
      );
    }

    if (seen.has(pluginId)) {
      throw new Error(
        `${PACKAGE_MESSAGES_ERROR_PREFIX} ${source} configures ${JSON.stringify(pluginId)} twice. A plugin id is the package name, so the second registration can only overwrite the first.`,
      );
    }

    seen.add(pluginId);
  }

  return plugins
    .map(({ localeFiles, pluginId }) => ({ localeFiles, pluginId }))
    .filter(
      (plugin): plugin is ResolvedPackageMessagesModule =>
        plugin.localeFiles !== undefined,
    )
    .sort((a, b) => byKey(a.pluginId, b.pluginId));
};
