/* eslint-disable no-console */
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

import { getConfig } from "./get-config.js";
import {
  askConfirm,
  createReadline,
  cyan,
  dim,
  findI18nSourceFile,
  green,
  listAppLocaleFiles,
  prefix,
  type Readline,
  red,
  resolveField,
  yellow,
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

export const i18nDelete = async () => {
  const appDir = process.cwd();

  const webConfig = await getConfig({ optional: true });
  const config =
    webConfig ?? (await getConfig({ optional: true, type: "api.config" }));

  if (!config) {
    console.error(red("No vitnode.config.ts or vitnode.api.config.ts found."));
    process.exit(1);
  }

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

  const argCode = process.argv[3];
  const isInteractive = process.stdin.isTTY ?? false;
  // Open readline when interactive - both to prompt for a missing code and to
  // confirm before deleting.
  const rl: null | Readline = isInteractive ? createReadline() : null;
  const sourceFile = findI18nSourceFile(appDir);
  const headingFor = (value: string): string => {
    const label = existingLocales.find(locale => locale.code === value)?.name;

    return label ? `${label} (${value})` : value;
  };

  let code = "";
  let confirmed = true;
  try {
    code = await resolveField({
      missingMessage: "Missing locale code. Run: vitnode i18n:delete <code>",
      provided: argCode,
      question: cyan("? Locale code to remove: "),
      rl,
      validate: validateCode,
    });

    // Confirm before touching anything - deleting is not easily undone.
    if (rl) {
      console.log(`\n${prefix} About to remove ${yellow(headingFor(code))}:`);
      for (const file of appFiles.filter(f => f.locale === code)) {
        console.log(dim(`  delete  ${relative(appDir, file.path)}`));
      }
      if (sourceFile) {
        console.log(dim(`  update  ${relative(appDir, sourceFile)}`));
      }
      confirmed = await askConfirm(rl, cyan("\n? Remove it? [y/N] "));
    }
  } finally {
    rl?.close();
  }

  if (!confirmed) {
    console.log(dim("\nAborted, nothing was removed."));
    process.exit(0);
  }

  console.log();

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
    console.log(green(`  deleted  ${relative(appDir, file.path)}`));
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
      console.log(green(`  updated  ${relative(appDir, sourceFile)}`));
    }
  }

  console.log(`\n${prefix} ${green(headingFor(code))} removed.`);
  process.exit(0);
};
