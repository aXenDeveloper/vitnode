// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { i18nCheck } from "./i18n-check";

const writeApp = (
  root: string,
  files: Record<string, Record<string, unknown>>,
) => {
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "package.json"), "{}");
  writeFileSync(
    join(root, "src", "vitnode.config.ts"),
    `export const vitNodeConfig = { i18n: { defaultLocale: "en", locales: [{ code: "en" }, { code: "pl" }] }, plugins: [] }`,
  );
  mkdirSync(join(root, "src", "locales", "site"), { recursive: true });
  writeFileSync(
    join(root, "src", "locales", "app.ts"),
    `export const appMessages = { en: { site: () => null }, pl: { site: () => null } }`,
  );
  writeFileSync(
    join(root, "src", "vitnode.server.config.ts"),
    `import { appMessages } from "@/locales/app"\nexport const vitNodeServerConfig = { messages: appMessages }`,
  );

  for (const [locale, tree] of Object.entries(files)) {
    writeFileSync(
      join(root, "src", "locales", "site", `${locale}.json`),
      JSON.stringify(tree),
    );
  }
};

describe("i18nCheck with an app-owned namespace", () => {
  let root: string;
  let output: string[];
  let exit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "vitnode-i18n-check-"));
    output = [];
    vi.spyOn(process, "cwd").mockReturnValue(root);
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      output.push(args.join(" "));
    });
    exit = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { force: true, recursive: true });
  });

  it("lists keys the app's Polish file is missing and fails under --ci", async () => {
    writeApp(root, {
      en: { site: { hero: { title: "Title", cta: "Explore" } } },
      pl: { site: { hero: { title: "Tytuł" } } },
    });

    await i18nCheck("--ci");

    const report = output.join("\n");
    expect(report).toContain("site · pl: 1 key(s) missing");
    expect(report).toContain("site.hero.cta");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("reports a complete translation", async () => {
    writeApp(root, {
      en: { site: { hero: { title: "Title" } } },
      pl: { site: { hero: { title: "Tytuł" } } },
    });

    await i18nCheck();

    const report = output.join("\n");
    expect(report).toContain("site · pl: complete");
    expect(report).not.toContain("never loaded");
  });

  it("errors when the namespace has no default-locale file", async () => {
    writeApp(root, { pl: { site: { hero: { title: "Tytuł" } } } });

    await i18nCheck();

    expect(output.join("\n")).toContain(
      'site: no "en" messages - create src/locales/site/en.json',
    );
    expect(exit).toHaveBeenCalledWith(1);
  });
});
