// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const VIEWS = join(SRC, "views");

const messages = JSON.parse(
  readFileSync(join(SRC, "locales/en.json"), "utf8"),
) as Record<string, unknown>;

const sourceFiles = (dir: string): string[] => {
  const found: string[] = [];

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(path) && !path.includes(".test.")) found.push(path);
  }

  return found;
};

const lookup = (path: string): string | undefined => {
  let node: unknown = messages;

  for (const part of path.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }

  return typeof node === "string" ? node : undefined;
};

/** `<title></title>` and friends - a tag next-intl expects a function for. */
const RICH_TAG = /<([a-zA-Z][\w-]*)>[\s\S]*?<\/\1>/;

/** `const t = useTranslations("core.content.schedule")`, per variable name. */
const SCOPE =
  /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*"([^"]+)"\s*\)/g;

const mismatches = (): string[] => {
  const found: string[] = [];

  for (const file of sourceFiles(VIEWS)) {
    const source = readFileSync(file, "utf8");
    const scopes = new Map(
      [...source.matchAll(SCOPE)].map(match => [match[1], match[2]]),
    );
    if (scopes.size === 0) continue;

    // Only literal keys. A template literal is resolved at runtime, and a
    // message chosen dynamically is not something this can reason about.
    const call = new RegExp(
      `\\b(${[...scopes.keys()].join("|")})(\\.rich)?\\(\\s*"([^"]+)"`,
      "g",
    );

    for (const match of source.matchAll(call)) {
      const [, variable, rich, key] = match;
      const message = lookup(`${scopes.get(variable)}.${key}`);

      // Missing keys are a different bug, and plugin locales live elsewhere.
      if (message === undefined || rich || !RICH_TAG.test(message)) continue;

      const line = source.slice(0, match.index).split("\n").length;
      found.push(
        `${relative(SRC, file)}:${line} - ${variable}("${key}") must be ${variable}.rich(...)`,
      );
    }
  }

  return found;
};

describe("rich message call sites", () => {
  it("calls t.rich for every message that carries a tag", () => {
    // A message like `Publish <title></title> at a set time` needs a *function*
    // for `title`. Handing `t()` a plain string throws
    // `FORMATTING_ERROR: Value for "title" must be of type function` - at render
    // time, in the browser, with nothing at compile time to stop it.
    //
    // No UI test catches this either: they all mock `useTranslations` with a
    // `t` that ignores its arguments, which is the right trade for testing
    // behaviour and exactly why this class of bug survives. So it is checked
    // here, statically, against the real messages.
    expect(mismatches()).toEqual([]);
  });
});
