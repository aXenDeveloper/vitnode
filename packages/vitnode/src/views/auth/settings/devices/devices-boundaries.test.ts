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
 * `/settings/devices`, split down the middle.
 *
 * The same boundary `files-boundaries.test.ts` and `auth-boundaries.test.ts`
 * draw, with the same machinery and for the same reason: a shared module that
 * reaches `next/headers`, a server action or `@/lib/navigation` cannot be loaded
 * by a TanStack Start route, and nothing about that failure is visible until
 * somebody tries. A scan is the only way to state it, because the offending
 * import is usually two files away from the one being written - this feature's
 * would have been the server action, imported by the revoke button, behind the
 * list.
 */
const SHARED = {
  item: join(here, "device-item.tsx"),
  list: join(here, "devices-content.tsx"),
  query: join(here, "devices-query.ts"),
  revoke: join(here, "devices-revoke.ts"),
  revokeButton: join(here, "revoke-device-button.tsx"),
  skeleton: join(here, "devices-list-skeleton.tsx"),
};

/** The Next.js half: `next/navigation`, `next/cache`, `fetcher()`, the action. */
/**
 * The Next.js half, by path, so its absence can be asserted.
 *
 * Named rather than deleted along with the assertions that used them: each was
 * the one place a Next.js API was allowed to appear in this subtree, and a test
 * that stops naming them cannot notice one coming back.
 */
const DELETED_NEXT_HALF = {
  list: join(here, "devices-list.tsx"),
  page: join(here, "devices.tsx"),
};

const sharedEntries = Object.entries(SHARED).map(([name, path]) => ({
  name,
  path,
}));
describe("the shared devices modules are framework-neutral", () => {
  it.each(sharedEntries)("$name reaches nothing from next/*", ({ path }) => {
    expect(offenders(path, NEXT_ONLY)).toEqual([]);
  });

  it.each(sharedEntries)(
    "$name reaches none of next-intl's Next-only entrypoints",
    ({ path }) => {
      expect(offenders(path, NEXT_INTL)).toEqual([]);
    },
  );

  it.each(sharedEntries)("$name never reaches a server action", ({ path }) => {
    // A `"use server"` module is the other way Next.js gets in: importing one
    // pulls the fetcher, `next/headers` and the whole API module graph behind it.
    // The revoke is a prop instead.
    const reached = [...externalGraph(path).keys()];

    expect(reached.some(one => one.endsWith(".server"))).toBe(false);
    expect(runtimeImports(path).some(one => one.includes(".server"))).toBe(
      false,
    );
  });

  it("never imports the API's own module for one plugin id", () => {
    // The fetchers need the users module's *type* to keep route literals
    // inferring; a value import would drag Hono, Drizzle and `@/database` into
    // the browser bundle of every page that lists a device.
    const reached = [...externalGraph(SHARED.query).keys()];

    expect(reached).not.toContain("drizzle-orm");
    expect(reached.some(one => one.startsWith("hono"))).toBe(false);
  });
});

describe("the shared list takes its framework parts as props", () => {
  const withoutComments = (path: string): string =>
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  it("is handed the devices rather than fetching them", () => {
    const code = withoutComments(SHARED.list);

    expect(code).toContain("devices: Device[];");
    expect(code).not.toContain("useQuery");
    expect(code).not.toContain("fetcher");
  });

  it("is handed the revoke rather than importing one", () => {
    const code = withoutComments(SHARED.list);

    expect(code).toContain("onRevoke: RevokeDevice;");
  });

  it("passes the revoke down to the button rather than the button finding it", () => {
    expect(withoutComments(SHARED.revokeButton)).toContain(
      "onRevoke: RevokeDevice;",
    );
  });
});

describe("the Next.js half of this subtree is gone", () => {
  it.each(Object.entries(DELETED_NEXT_HALF))(
    "%s no longer exists",
    (_name, path) => {
      expect(existsSync(path)).toBe(false);
    },
  );
});
