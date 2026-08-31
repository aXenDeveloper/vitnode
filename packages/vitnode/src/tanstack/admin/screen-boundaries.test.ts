// @vitest-environment node
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { NEXT_INTL, NEXT_ONLY, offenders } from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Every AdminCP screen's browser graph, one screen at a time and with the chain.
 *
 * `next-boundary.test.ts` already asserts that no file in this package names
 * `next/*`, `next-intl` or the React `server-only` marker, which subsumes what
 * this file claims. It is kept because of *where* the answer lands: a screen
 * breaks three or six hops from the file being edited - the real one was
 * `dashboard/route.tsx` reaching `next-intl/server` through two lines of shared
 * arithmetic that had been left in the wrong module - and `offenders` prints the
 * chain rather than the specifier. That is the difference between a five-minute
 * fix and an afternoon, and it is a per-screen fact a package-wide file scan
 * cannot phrase.
 *
 * What is gone is this file's own copy of the scanner. It carried its own
 * `resolveSpecifier`, its own forbidden lists and its own breadth-first walk -
 * around a hundred and thirty lines, the fourth such copy in the package, and
 * the one whose forbidden list still named `@/lib/fetcher` and
 * `@/lib/navigation` long after both modules were deleted. A negative assertion
 * against a module that cannot exist passes by finding less, which is the one
 * way a boundary test fails silently. One scanner, in `@/tests/import-graph`,
 * with its positive controls in `next-boundary.test.ts`.
 */

/** Every `tanstack/admin/<name>` directory - one per AdminCP screen. */
const allScreens = readdirSync(here)
  .filter(name => statSync(join(here, name)).isDirectory())
  .filter(name => existsSync(join(here, name, "index.ts")))
  .sort((a, b) => a.localeCompare(b));

/**
 * Every screen, with no opt-out list.
 *
 * There was one while the migration ran in waves, and the reason it is gone is
 * worth keeping, because it is the failure the list itself produced. `roles` sat
 * on the excluded side with a note naming its exact chain:
 *
 *     roles/index.ts -> roles/route.tsx -> roles-table-content.tsx
 *       -> role-form-content.tsx -> components/form/fields/color.tsx
 *       -> components/ui/color-picker.tsx -> next-intl
 *
 * The note ended "whoever migrates it will meet it". The screen was then
 * migrated and shipped, the colour picker was not swapped, and the exclusion
 * stopped describing future work and started hiding a live violation - on a
 * route `apps/web` serves. Nothing failed, because the one test that looks had
 * been told not to look there.
 *
 * So the list is derived. A screen is guarded by existing, which means a new one
 * is guarded before anybody remembers this file. If a future screen genuinely
 * cannot be clean yet, the honest move is a failing test and a decision - not a
 * name on a list.
 */
const screens = allScreens;

/**
 * `@tanstack/react-start/server-only` is permitted and must be: it is a marker
 * the Start compiler reads to keep a module out of the client bundle, which is
 * how each screen's `server.ts` is allowed to sit inside a graph a browser
 * walks. `NEXT_ONLY`'s `server-only` is the React one, which throws when
 * evaluated - and `offenders` matches whole path segments, so the two never
 * collide. `next-boundary.test.ts` holds the control for that.
 */
const FORBIDDEN = [...NEXT_ONLY, ...NEXT_INTL];

describe("this test is looking at the right tree", () => {
  it("finds every screen", () => {
    // The control: a scan that found no screens would pass every assertion
    // below. A floor rather than an exact list, so adding a screen does not
    // require editing this test - which is what the old allowlist made
    // necessary, and what it got wrong.
    expect(screens.length).toBeGreaterThanOrEqual(10);
    expect(screens).toContain("cron");
    expect(screens).toContain("roles");
    expect(screens).toContain("users");
  });

  it("guards every screen that exists, with no exceptions", () => {
    // The rule this file exists to state. If the derived set and the walked set
    // ever diverge, an opt-out has been reintroduced.
    expect(screens).toEqual(allScreens);
  });

  it("walks into each screen rather than reading its barrel alone", () => {
    // Every assertion below is "found nothing", which a walk that stopped at
    // `index.ts` would satisfy completely. The barrels re-export, so a real walk
    // reaches the design system and React Query behind them.
    const reached = offenders(join(here, "users", "index.ts"), ["react"]);

    expect(reached.length).toBeGreaterThan(0);
  });
});

describe("an AdminCP screen reaches nothing Next.js-only", () => {
  it.each(screens)("%s", screen => {
    expect(offenders(join(here, screen, "index.ts"), FORBIDDEN)).toEqual([]);
  });
});

describe("the shell barrel reaches nothing Next.js-only either", () => {
  it("imports no Next.js module, directly or transitively", () => {
    // Every admin page loads this one, so it is the widest surface of the same
    // rule.
    expect(offenders(join(here, "index.ts"), FORBIDDEN)).toEqual([]);
  });
});
