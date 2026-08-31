// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  externalGraph,
  NEXT_INTL,
  NEXT_ONLY,
  offenders,
  runtimeImports,
} from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The main shell, split down the middle.
 *
 * The same boundary `auth-boundaries.test.ts` draws around the login screens,
 * for the same reason and with the same machinery: `ThemeLayoutContent` is
 * rendered by a TanStack Start route as well as by Next.js, and a single import
 * that only resolves inside a Next.js app turns that route into a build error
 * nobody sees until they try it.
 *
 * The shared half is the *structure* - the slot order and the `<main>` landmark.
 * Everything that fills a slot is the framework's, and `layout.tsx` is the proof
 * that the Next.js half really does reach the things the shared half must not.
 */
const SHARED_ENTRY = join(here, "layout-content.tsx");
/**
 * The Next.js half, by path, so its absence can be asserted.
 *
 * Named rather than deleted along with the assertions that used them: each was
 * the one place a Next.js API was allowed to appear in this subtree, and a test
 * that stops naming them cannot notice one coming back.
 */
const DELETED_NEXT_HALF = join(here, "layout.tsx");

describe("the shared main shell is framework-neutral", () => {
  it("reaches nothing from next/*", () => {
    expect(offenders(SHARED_ENTRY, NEXT_ONLY)).toEqual([]);
  });

  it("reaches none of next-intl's Next-only entrypoints", () => {
    expect(offenders(SHARED_ENTRY, NEXT_INTL)).toEqual([]);
  });

  it("never reaches the locale-aware navigation module", () => {
    const reached = [...externalGraph(SHARED_ENTRY).keys()];

    expect(reached.some(one => one.includes("navigation"))).toBe(false);
  });

  it("never reaches a server action", () => {
    const reached = [...externalGraph(SHARED_ENTRY).keys()];

    expect(reached.some(one => one.endsWith(".server"))).toBe(false);
    expect(
      runtimeImports(SHARED_ENTRY).some(one => one.includes(".server")),
    ).toBe(false);
  });
});

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

describe("the Next.js half of this subtree is gone", () => {
  it("no longer exists", () => {
    expect(existsSync(DELETED_NEXT_HALF)).toBe(false);
  });
});
