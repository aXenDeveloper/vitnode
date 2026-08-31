// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The main shell's slot boundary.
 *
 * `ThemeLayoutContent` is the *structure* - the slot order and the `<main>`
 * landmark - and everything that fills a slot is the host's. That is the claim
 * only this file can make: whether the shared half still asks for its framework
 * parts rather than reaching for them.
 *
 * What it no longer asserts is that the structure imports nothing from Next.js.
 * That was the same claim from a single entry point, and `next-boundary.test.ts`
 * now makes it over every file in the package at once - including this one, and
 * including the files a reachability walk from here happens not to touch.
 */
const SHARED_ENTRY = join(
  dirname(fileURLToPath(import.meta.url)),
  "layout-content.tsx",
);

describe("the shared main shell takes its framework parts as slots", () => {
  const withoutComments = (path: string): string =>
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  const code = withoutComments(SHARED_ENTRY);

  it.each(["breadcrumb", "header", "listeners"])(
    "asks for %s rather than rendering it",
    slot => {
      expect(code).toContain(slot);
    },
  );

  it("renders the header and the notification listeners itself in neither case", () => {
    expect(code).not.toContain("HeaderLayout");
    expect(code).not.toContain("NotificationListener");
    expect(code).not.toContain("WebSocketAuthSync");
  });

  /**
   * One `<main>`, in the shell. A page under it renders its own container, not a
   * second landmark - see the note on `ThemeLayoutContent`.
   */
  it("owns the one main landmark", () => {
    expect(code.match(/<main>/g)).toHaveLength(1);
  });
});
