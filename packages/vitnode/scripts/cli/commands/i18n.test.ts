// @vitest-environment node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runCli } from "../index";
import { createFakeRuntime, createScriptedPrompter } from "../testing";

let root: string;

const write = (path: string, content: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};

/** An app with an English and a Polish translation of its own namespace. */
const app = () => {
  write("package.json", "{}");
  write(
    "src/i18n.ts",
    `export const i18n = {
  defaultLocale: "en",
  locales: [
    { code: "en", name: "English" },
    { code: "pl", name: "Polski" },
  ],
};
`,
  );
  write(
    "src/vitnode.config.ts",
    `import { i18n } from "./i18n";\nexport const vitNodeConfig = { i18n, plugins: [] };\n`,
  );
  write(
    "src/locales/app.ts",
    "export const appMessages = { en: { site: () => null }, pl: { site: () => null } };\n",
  );
  write(
    "src/vitnode.server.config.ts",
    'import { appMessages } from "@/locales/app";\nexport const vitNodeServerConfig = { messages: appMessages };\n',
  );
  write(
    "src/locales/site/en.json",
    JSON.stringify({ site: { cta: "Explore", title: "Title" } }),
  );
  write(
    "src/locales/site/pl.json",
    JSON.stringify({ site: { title: "Tytuł" } }),
  );
};

const run = async (
  argv: string[],
  options: Parameters<typeof createFakeRuntime>[0] = {},
) => {
  const runtime = createFakeRuntime({ cwd: root, ...options });
  const code = await runCli(argv, runtime);

  return { code, errors: runtime.errors(), output: runtime.output() };
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vitnode-i18n-"));
  app();
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("vitnode i18n check", () => {
  it("fails under --ci with exit code 1 - never through process.exit", async () => {
    const { code, errors, output } = await run(["i18n", "check", "--ci"]);

    expect(code).toBe(1);
    expect(output).toContain("site · pl: 1 key(s) missing");
    expect(errors).toMatch(/✖ \d+ issue\(s\), 1 untranslated key\(s\)\./);
  });

  it("keeps working under its older name", async () => {
    expect((await run(["i18n:check", "--ci"])).code).toBe(1);
    expect((await run(["i18n:check", "--cii"])).code).toBe(2);
  });
});

describe("vitnode i18n update", () => {
  it("adds the missing keys in the default language and keeps translations", async () => {
    const { code, output } = await run(["i18n", "update"]);

    expect(code).toBe(0);
    expect(output).toContain("updated  src/locales/site/pl.json");
    expect(
      JSON.parse(readFileSync(join(root, "src/locales/site/pl.json"), "utf8")),
    ).toEqual({ site: { cta: "Explore", title: "Tytuł" } });
  });
});

describe("vitnode i18n create", () => {
  it("adds a language from the command line, without asking", async () => {
    const { code, output } = await run(["i18n", "create", "de", "Deutsch"]);

    expect(code).toBe(0);
    expect(output).toContain("✓ Deutsch (de) added.");
    expect(readFileSync(join(root, "src/i18n.ts"), "utf8")).toContain(
      '{ code: "de", name: "Deutsch" }',
    );
  });

  it("refuses to wait for a code nobody can type", async () => {
    const { code, errors } = await run(["i18n", "create"]);

    expect(code).toBe(2);
    expect(errors).toContain("Missing locale code.");
  });

  it("refuses an invalid code given on the command line", async () => {
    const { code, errors } = await run(["i18n", "create", "Polish!", "Polski"]);

    expect(code).toBe(2);
    expect(errors).toContain("Use an ISO code");
  });

  it("asks for what is missing in an interactive terminal", async () => {
    const prompter = createScriptedPrompter({ text: ["de", "Deutsch"] });
    const { code } = await run(["i18n", "create"], {
      interactive: true,
      prompter,
    });

    expect(code).toBe(0);
    expect(prompter.asked).toEqual([
      "Locale code (e.g. pl, de, pt-BR)",
      "Language name (e.g. Polski, Deutsch)",
    ]);
  });
});

describe("vitnode i18n delete", () => {
  it("needs --yes to delete from a script", async () => {
    const { code, errors } = await run(["i18n", "delete", "pl"]);

    expect(code).toBe(2);
    expect(errors).toContain("Pass --yes");
    expect(existsSync(join(root, "src/locales/site/pl.json"))).toBe(true);
  });

  it("removes the language's files and config entry with --yes", async () => {
    const { code, output } = await run(["i18n", "delete", "pl", "--yes"]);

    expect(code).toBe(0);
    expect(output).toContain("deleted  src/locales/site/pl.json");
    expect(existsSync(join(root, "src/locales/site/pl.json"))).toBe(false);
    expect(readFileSync(join(root, "src/i18n.ts"), "utf8")).not.toContain(
      '"pl"',
    );
  });

  it("refuses to remove the default locale", async () => {
    const { code, errors } = await run(["i18n", "delete", "en", "--yes"]);

    expect(code).toBe(2);
    expect(errors).toContain("English is the built-in fallback");
  });
});

describe("vitnode i18n update-ai", () => {
  it("validates --concurrency before doing anything", async () => {
    const { code, errors } = await run([
      "i18n",
      "update-ai",
      "pl",
      "--concurrency",
      "zero",
    ]);

    expect(code).toBe(2);
    expect(errors).toContain('"zero" is not a valid --concurrency.');
  });
});
