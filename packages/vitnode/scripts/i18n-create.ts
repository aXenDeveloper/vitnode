/* eslint-disable no-console */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { getConfig } from "./get-config.js";
import {
  appScope,
  CORE_PLUGIN_ID,
  createReadline,
  cyan,
  dim,
  effectiveDefaultTree,
  findI18nSourceFile,
  green,
  prefix,
  type Readline,
  red,
  resolveField,
} from "./i18n-shared.js";
import { findRepoRoot } from "./shared/file-utils.js";

const LOCALE_CODE_PATTERN = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

/**
 * One message loader, indented, with the path spelled relative to the file it
 * is being written into.
 *
 * `src/locales/app.ts` sits inside `src/locales`, so its loaders are
 * `./<pluginId>/<code>.json`. A config at `src/` reaches the same file through
 * `./locales/<pluginId>/<code>.json`.
 */
const messageEntry = (
  indent: string,
  pluginId: string,
  code: string,
  prefixPath = "./locales",
) =>
  `${indent}"${pluginId}": () => import("${prefixPath}/${pluginId}/${code}.json"),`;

/**
 * A TypeScript string literal for arbitrary text. `JSON.stringify` escapes
 * quotes, backslashes, and newlines, so a free-form language name like
 * `Foo "Bar"` can't break out of its quotes and corrupt the generated config.
 * For simple inputs the result is byte-identical to `"value"`.
 */
const stringLiteral = (value: string): string => JSON.stringify(value);

/** True when the char right after an opening bracket starts a new line. */
const opensOnNewLine = (source: string, afterOpen: number): boolean =>
  /^[^\S\n]*\n/.test(source.slice(afterOpen));

/** Where an app keeps the message overrides its server config registers. */
const APP_MESSAGES_FILE = join("src", "locales", "app.ts");

/**
 * Adds a `<code>: { ...loaders }` block to an app's `appMessages` map.
 *
 * The map that `vitnode.server.config.ts` hands to the messages loader, and the
 * only correct target when an app has one: the shared `vitnode.config.ts` is
 * browser-safe by contract, so a `() => import(...)` written into its `i18n`
 * block is both in the browser bundle and in the file Vite loads with `jiti` to
 * discover plugins.
 *
 * Returns `null` when the file has no `appMessages` object to edit, so the
 * caller can fall back to the config or to printing instructions.
 */
export const addLocaleToAppMessages = (
  source: string,
  { code, pluginIds }: { code: string; pluginIds: string[] },
): null | string => {
  const anchor = /\bappMessages\s*(?::[^=]*)?=\s*\{/.exec(source);
  if (anchor?.index === undefined) return null;

  const at = anchor.index + anchor[0].length;
  const entries = pluginIds
    .map(id => messageEntry("    ", id, code, "."))
    .join("\n");
  const inner = `\n  "${code}": {\n${entries}\n  },`;

  // Close the object onto its own line when it was written inline (`{}`).
  return (
    source.slice(0, at) +
    (opensOnNewLine(source, at) ? inner : `${inner}\n`) +
    source.slice(at)
  );
};

/**
 * Bounds of the app's `i18n` config object, `{ start, end }` pointing at its
 * opening and closing braces. Both edits below must land *inside* this object:
 * an inline config can carry an unrelated `locales` array or `messages` object
 * in a plugin's options before the i18n block, and a whole-file search would
 * splice the new language into that first match instead - reporting success
 * while the runtime config stays untouched.
 *
 * The object is always introduced by `i18n: {` inside a config, or `i18n = {` in
 * a standalone declaration - neither of which a plugin's option block can spoof.
 * Returns `null` when no such object is found, so callers fall back to printing
 * manual instructions rather than editing blindly.
 */
const i18nObjectBounds = (
  source: string,
): null | { end: number; start: number } => {
  const anchor = /\bi18n\s*[:=]\s*\{/.exec(source);
  if (anchor?.index === undefined) return null;

  const start = anchor.index + anchor[0].length - 1; // the `{` itself
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return { end: i, start };
    }
  }

  return null;
};

/**
 * First match of `re` at or after `from` but before `to`, or `null`. `re` must
 * carry the `g` flag so `lastIndex` positions the search; `^`/`m` still anchor
 * to line starts at or after `from`.
 */
const execInRange = (
  re: RegExp,
  source: string,
  from: number,
  to: number,
): null | RegExpExecArray => {
  re.lastIndex = from;
  const match = re.exec(source);

  return match && match.index < to ? match : null;
};

/**
 * Inserts a `{ code, name }` object as the first element of the `locales`
 * array. Prepending sidesteps the trailing-comma-before-`]` problem, so the
 * result stays valid whatever the surrounding formatting looks like. When the
 * array was written inline (`[{ ... }]`) the existing entry is pushed onto its
 * own line too, so the result reads cleanly without a formatter.
 *
 * Returns `null` when the file has no recognisable `locales: [` array to edit.
 */
export const addLocaleToConfig = (
  source: string,
  { code, name }: { code: string; name: string },
): null | string => {
  const bounds = i18nObjectBounds(source);
  if (!bounds) return null;

  const match = execInRange(
    /^([^\S\n]*)locales\s*:\s*\[/gm,
    source,
    bounds.start,
    bounds.end,
  );
  if (!match) return null;

  const indent = `${match[1]}  `;
  const at = match.index + match[0].length;
  const entry = `{ code: ${stringLiteral(code)}, name: ${stringLiteral(name)} },`;
  const insertion = opensOnNewLine(source, at)
    ? `\n${indent}${entry}`
    : `\n${indent}${entry}\n${indent}`;

  return source.slice(0, at) + insertion + source.slice(at);
};

/** Index of the `]` that closes the array whose `[` sits at `openIndex`. */
const matchingBracket = (source: string, openIndex: number): number => {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    if (source[i] === "[") depth += 1;
    else if (source[i] === "]") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
};

/**
 * Adds a `<code>: { ...loaders }` block to `messages`. Extends the object when
 * it already exists, otherwise drops a whole `messages` block in right after
 * the `locales` array. Assumes `addLocaleToConfig` has already run, so a
 * `locales` array is guaranteed to be present.
 */
export const addMessagesToConfig = (
  source: string,
  { code, pluginIds }: { code: string; pluginIds: string[] },
): null | string => {
  const bounds = i18nObjectBounds(source);
  if (!bounds) return null;

  const existing = execInRange(
    /^([^\S\n]*)messages\s*:\s*\{/gm,
    source,
    bounds.start,
    bounds.end,
  );

  if (existing) {
    const baseIndent = existing[1];
    const codeIndent = `${baseIndent}  `;
    const entryIndent = `${codeIndent}  `;
    const entries = pluginIds
      .map(id => messageEntry(entryIndent, id, code))
      .join("\n");
    const at = existing.index + existing[0].length;
    const inner = `\n${codeIndent}"${code}": {\n${entries}\n${codeIndent}},`;
    // Close the object onto its own line when it was written inline (`{}`).
    const block = opensOnNewLine(source, at)
      ? inner
      : `${inner}\n${baseIndent}`;

    return source.slice(0, at) + block + source.slice(at);
  }

  // No `messages` yet - place one straight after the `locales` array.
  const locales = execInRange(
    /^([^\S\n]*)locales\s*:\s*\[/gm,
    source,
    bounds.start,
    bounds.end,
  );
  if (!locales) return null;

  const open = source.indexOf("[", locales.index);
  const close = matchingBracket(source, open);
  if (close === -1) return null;

  const indent = locales[1];
  const codeIndent = `${indent}  `;
  const entryIndent = `${codeIndent}  `;
  const entries = pluginIds
    .map(id => messageEntry(entryIndent, id, code))
    .join("\n");

  // The array may or may not carry a trailing comma; normalise either way.
  let at = close + 1;
  let lead = ",";
  if (source[at] === ",") {
    at += 1;
    lead = "";
  }
  const block = `${lead}\n${indent}messages: {\n${codeIndent}"${code}": {\n${entries}\n${codeIndent}},\n${indent}},`;

  return source.slice(0, at) + block + source.slice(at);
};

/**
 * A standalone `src/i18n.ts` for an app whose config declares no languages at
 * all.
 *
 * The last resort, and it should stay unreachable: every VitNode app declares
 * `i18n` inside `vitnode.config.ts` (web) or `vitnode.api.config.ts` (API), and
 * that is what {@link findI18nSourceFile} finds. This exists so an
 * API-only project that opted out of the block entirely gets a file to import
 * rather than a silent no-op.
 */
export const buildI18nFile = ({
  code,
  defaultLocale,
  locales,
  name,
  pluginIds,
}: {
  code: string;
  defaultLocale: string;
  locales: { code: string; name: string }[];
  name: string;
  pluginIds: string[];
}): string => {
  const localeLines = [...locales, { code, name }]
    .map(
      locale =>
        `    { code: ${stringLiteral(locale.code)}, name: ${stringLiteral(locale.name)} },`,
    )
    .join("\n");
  const entries = pluginIds
    .map(id => messageEntry("      ", id, code))
    .join("\n");

  return `import type { VitNodeI18nConfig } from "@vitnode/core/lib/i18n/types";

/**
 * Shared by \`vitnode.config.ts\` (web) and \`vitnode.api.config.ts\` (API) so the
 * site and its emails agree on which languages exist. Packages ship their own
 * languages - only what this app adds or reworks needs a file here.
 */
export const i18n = {
  defaultLocale: "${defaultLocale}",
  locales: [
${localeLines}
  ],
  messages: {
    "${code}": {
${entries}
    },
  },
} satisfies VitNodeI18nConfig;
`;
};

export const i18nCreate = async () => {
  const appDir = process.cwd();

  // Load both configs: their presence tells us the app's shape (frontend, API,
  // or both), which decides how much of each package to seed.
  const webConfig = await getConfig({ optional: true });
  const apiConfig = await getConfig({ optional: true, type: "api.config" });
  const config = webConfig ?? apiConfig;

  if (!config) {
    console.error(red("No vitnode.config.ts or vitnode.api.config.ts found."));
    process.exit(1);
  }

  // An API-only app seeds email strings alone; a single app gets both trees.
  const scope = appScope({ api: apiConfig !== null, web: webConfig !== null });
  const isApiOnly = webConfig === null;
  const defaultLocale = config.i18n?.defaultLocale ?? "en";
  const existingLocales = (config.i18n?.locales ?? []).map(locale => ({
    code: locale.code,
    name: locale.name,
  }));
  const knownCodes = new Set([
    defaultLocale,
    ...existingLocales.map(locale => locale.code),
  ]);
  // Union plugin ids across both configs - a plugin might be registered only on
  // the API side (e.g. it just sends email) yet still needs a seed file.
  const pluginIds = [
    ...new Set([
      CORE_PLUGIN_ID,
      ...[webConfig, apiConfig].flatMap(loaded =>
        ((loaded?.plugins ?? []) as { pluginId: string }[]).map(
          plugin => plugin.pluginId,
        ),
      ),
    ]),
  ].sort((a, b) => a.localeCompare(b));

  const validateCode = (value: string): null | string => {
    if (!value) return "A locale code is required.";
    if (!LOCALE_CODE_PATTERN.test(value)) {
      return "Use an ISO code like `pl`, `de`, or `pt-BR`.";
    }
    if (knownCodes.has(value)) return `"${value}" already exists in this app.`;

    return null;
  };
  const validateName = (value: string): null | string =>
    value ? null : "A language name is required.";

  // `vitnode i18n:create [code] [name...]` - anything supplied on the command
  // line skips its prompt, so the command is scriptable and never blocks on a
  // non-interactive stdin.
  const [argCode, ...argNameParts] = process.argv.slice(3);
  const argName = argNameParts.join(" ").trim() || undefined;
  const isInteractive = process.stdin.isTTY ?? false;
  const needsPrompt = argCode === undefined || argName === undefined;
  const rl: null | Readline =
    isInteractive && needsPrompt ? createReadline() : null;
  const missing = 'Run: vitnode i18n:create <code> "<name>"';

  if (rl) {
    console.log(`${prefix} Add a language. Press Ctrl+C to abort.\n`);
  }

  let code: string;
  let name: string;
  try {
    code = await resolveField({
      missingMessage: `Missing locale code. ${missing}`,
      provided: argCode,
      question: cyan("? Locale code (e.g. pl, de, pt-BR): "),
      rl,
      validate: validateCode,
    });
    name = await resolveField({
      missingMessage: `Missing language name. ${missing}`,
      provided: argName,
      question: cyan("? Language name (e.g. Polski, Deutsch): "),
      rl,
      validate: validateName,
    });
  } finally {
    rl?.close();
  }

  console.log();

  // 1. Seed one override file per package with that package's default-locale
  //    strings for the trees this app uses, so every key is present to
  //    translate in place instead of starting from an empty object.
  let repoRoot = appDir;
  try {
    repoRoot = findRepoRoot(appDir);
  } catch {
    // Not inside a project root (unusual) - fall back to empty templates.
  }

  const created: string[] = [];
  const skipped: string[] = [];
  const empty: string[] = [];
  // Only the packages that actually have strings in this scope get a file - and
  // only those get wired into the config, so no loader points at a file that
  // was never written (e.g. a plugin with no server strings in an API-only app).
  const wiredPluginIds: string[] = [];

  for (const pluginId of pluginIds) {
    const filePath = join(appDir, "src", "locales", pluginId, `${code}.json`);
    if (existsSync(filePath)) {
      skipped.push(relative(appDir, filePath));
      wiredPluginIds.push(pluginId);
      continue;
    }

    // Only the trees this app uses, merged - so an API-only app is seeded with
    // the handful of email keys, not the whole admin UI it never renders. When
    // the app declares a default the package doesn't ship, the app's own
    // default-locale override stands in as the source, so a package is never
    // skipped just because its default tree lives in the app rather than the
    // package.
    const tree = effectiveDefaultTree(pluginId, {
      appDir,
      defaultLocale,
      repoRoot,
      scope,
    });
    if (Object.keys(tree).length === 0) {
      empty.push(pluginId);
      continue;
    }

    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(tree, null, 2)}\n`);
    created.push(relative(appDir, filePath));
    wiredPluginIds.push(pluginId);
  }

  for (const file of created) console.log(green(`  created  ${file}`));
  for (const file of skipped) console.log(dim(`  exists   ${file}`));
  for (const pluginId of empty) {
    console.log(dim(`  skipped  ${pluginId} (no strings for this app)`));
  }

  // 2. Wire the loaders into the app's own message map, which is where a
  //    server config reads them from. Attempted first and independently of the
  //    locale list below: the two live in different files now - the loaders in
  //    `src/locales/app.ts`, the languages in the shared config - and a project
  //    that has one and not the other should still get the half it has.
  const appMessagesPath = join(appDir, APP_MESSAGES_FILE);
  let wroteAppMessages = false;

  if (existsSync(appMessagesPath) && wiredPluginIds.length > 0) {
    const wired = addLocaleToAppMessages(
      readFileSync(appMessagesPath, "utf-8"),
      { code, pluginIds: wiredPluginIds },
    );

    if (wired) {
      writeFileSync(appMessagesPath, wired);
      console.log(green(`  updated  ${APP_MESSAGES_FILE}`));
      wroteAppMessages = true;
    }
  }

  // 3. Wire the locale into the i18n config.
  const sourceFile = findI18nSourceFile(appDir);

  if (!sourceFile) {
    const target = join(appDir, "src", "i18n.ts");
    writeFileSync(
      target,
      buildI18nFile({
        code,
        defaultLocale,
        locales: existingLocales,
        name,
        pluginIds: wiredPluginIds,
      }),
    );
    console.log(green(`  created  ${relative(appDir, target)}`));
    const builder = isApiOnly ? "buildApiConfig" : "buildConfig";
    console.log(
      `\n${prefix} Import it into your config so the app picks it up:\n` +
        dim('  import { i18n } from "./i18n";\n') +
        dim(`  ${builder}({ i18n, /* ... */ });`),
    );
  } else {
    const original = readFileSync(sourceFile, "utf-8");
    const withLocale = addLocaleToConfig(original, { code, name });
    // Only fall back to the config's own `messages` block when the app has no
    // `src/locales/app.ts` - a browser-safe config is the wrong home for a
    // loader, and writing to both would merge the same file twice.
    const wired =
      withLocale && !wroteAppMessages && wiredPluginIds.length > 0
        ? addMessagesToConfig(withLocale, { code, pluginIds: wiredPluginIds })
        : withLocale;

    if (wired) {
      writeFileSync(sourceFile, wired);
      console.log(green(`  updated  ${relative(appDir, sourceFile)}`));
    } else {
      // The config is shaped in a way we will not edit blindly - show the
      // exact lines to add instead of risking a broken file.
      console.log(
        `\n${prefix} Couldn't edit ${relative(appDir, sourceFile)} automatically. Add:\n` +
          dim(
            `  locales: [{ code: ${stringLiteral(code)}, name: ${stringLiteral(name)} }, /* ... */]`,
          ),
      );
    }

    if (!wroteAppMessages && wiredPluginIds.length > 0) {
      const messages = wiredPluginIds
        .map(id => `    "${id}": () => import("./${id}/${code}.json"),`)
        .join("\n");
      console.log(
        `\n${prefix} And register the files in ${APP_MESSAGES_FILE}:\n` +
          dim(`  "${code}": {\n${messages}\n  },`),
      );
    }
  }

  console.log(
    `\n${prefix} ${green(name)} (${code}) added. Translate the files above, then run ${cyan("vitnode i18n:check")}.`,
  );
  process.exit(0);
};
