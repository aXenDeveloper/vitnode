import {
  existsSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

import type { I18nContext } from "./i18n-shared.js";

import { EXIT_CODE } from "./cli/errors.js";
import { requireConfirmation } from "./cli/ui/prompts.js";
import { getConfig } from "./get-config.js";
import {
  findI18nSourceFile,
  listAppLocaleFiles,
  noConfigError,
  resolveField,
} from "./i18n-shared.js";

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

export const removeLocaleFromConfig = (
  source: string,
  code: string,
): string => {
  const array = /locales\s*:\s*\[/.exec(source);
  if (array?.index === undefined) return source;

  const open = source.indexOf("[", array.index);
  const close = matchingBracket(source, open);
  if (close === -1) return source;

  const re = new RegExp(
    `[^\\S\\n]*\\{[^{}]*\\bcode\\s*:\\s*["']${escapeRegExp(code)}["'][^{}]*\\}[^\\S\\n]*,?\\n?`,
  );

  const body = source.slice(open, close + 1);
  const cleaned = body.replace(re, "");
  if (cleaned === body) return source;

  return source.slice(0, open) + cleaned + source.slice(close + 1);
};

export const removeMessagesFromConfig = (
  source: string,
  code: string,
): string => {
  const key = escapeRegExp(code);
  const re = new RegExp(
    `[^\\S\\n]*["']?${key}["']?\\s*:\\s*\\{[^{}]*\\}[^\\S\\n]*,?\\n?`,
  );

  return source.replace(re, "");
};

/**
 * `vitnode i18n delete [code]` - removes a language: its translation files,
 * and its entries in the i18n config. Asks before deleting anything; in a
 * script, `yes` is that answer.
 */
export const i18nDelete = async ({
  code: provided,
  context,
  yes = false,
}: {
  code?: string;
  context: I18nContext;
  yes?: boolean;
}): Promise<number> => {
  const { cwd, prompter, ui } = context;
  const { colors } = ui;
  const appDir = cwd;

  const webConfig = await getConfig({ baseDir: cwd, optional: true });
  const config =
    webConfig ??
    (await getConfig({ baseDir: cwd, optional: true, type: "api.config" }));

  if (!config) throw noConfigError();

  const defaultLocale = config.i18n?.defaultLocale ?? "en";
  const existingLocales = (config.i18n?.locales ?? []).map(locale => ({
    code: locale.code,
    name: locale.name,
  }));
  const appFiles = listAppLocaleFiles(appDir);
  // A language "exists" if it is declared or has any override file on disk.
  const present = new Set([
    ...existingLocales.map(locale => locale.code),
    ...appFiles.map(file => file.locale),
  ]);

  const validateCode = (value: string): null | string => {
    if (!value) return "A locale code is required.";
    if (value === "en") {
      return "English is the built-in fallback and can't be removed.";
    }
    if (value === defaultLocale) {
      return `"${defaultLocale}" is the default locale - change \`defaultLocale\` before removing it.`;
    }
    if (!present.has(value)) return `No language "${value}" found in this app.`;

    return null;
  };

  const sourceFile = findI18nSourceFile(appDir);
  const headingFor = (value: string): string => {
    const label = existingLocales.find(locale => locale.code === value)?.name;

    return label ? `${label} (${value})` : value;
  };

  const code = await resolveField({
    context,
    missingMessage: "Missing locale code. Run: vitnode i18n delete <code>",
    provided,
    question: "Locale code to remove",
    validate: validateCode,
  });

  // Show exactly what goes before anything does - deleting is not easily
  // undone.
  ui.section(`About to remove ${headingFor(code)}`);
  for (const file of appFiles.filter(f => f.locale === code)) {
    ui.note(`delete  ${relative(appDir, file.path)}`);
  }
  if (sourceFile) ui.note(`update  ${relative(appDir, sourceFile)}`);
  ui.line();

  const confirmed = await requireConfirmation({
    message: `Remove ${headingFor(code)}?`,
    prompter,
    ui,
    yes,
  });

  if (!confirmed) {
    ui.note("Aborted, nothing was removed.");
    ui.line();

    return EXIT_CODE.ok;
  }

  // 1. Delete the override files, then any directory they leave empty.
  const localesRoot = join(appDir, "src", "locales");
  const pruneEmptyDirs = (fromDir: string) => {
    let dir = fromDir;
    while (dir.startsWith(localesRoot) && dir !== localesRoot) {
      if (existsSync(dir) && readdirSync(dir).length === 0) {
        rmdirSync(dir);
        dir = dirname(dir);
      } else {
        break;
      }
    }
  };
  for (const file of appFiles.filter(f => f.locale === code)) {
    unlinkSync(file.path);
    ui.line(colors.success(`  deleted  ${relative(appDir, file.path)}`));
    pruneEmptyDirs(dirname(file.path));
  }

  // 2. Unwire the locale from the i18n config.
  if (sourceFile) {
    const original = readFileSync(sourceFile, "utf-8");
    const updated = removeMessagesFromConfig(
      removeLocaleFromConfig(original, code),
      code,
    );
    if (updated !== original) {
      writeFileSync(sourceFile, updated);
      ui.line(colors.success(`  updated  ${relative(appDir, sourceFile)}`));
    }
  }

  ui.line();
  ui.success(`${headingFor(code)} removed.`);
  ui.line();

  return EXIT_CODE.ok;
};
