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

const SHARED = {
  item: join(here, "device-item.tsx"),
  list: join(here, "devices-content.tsx"),
  query: join(here, "devices-query.ts"),
  revoke: join(here, "devices-revoke.ts"),
  revokeButton: join(here, "revoke-device-button.tsx"),
  skeleton: join(here, "devices-list-skeleton.tsx"),
};

/** The Next.js half: `next/navigation`, `next/cache`, `fetcher()`, the action. */

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
