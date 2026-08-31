// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { externalGraph } from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * What `/settings/devices` keeps out of the browser, and what it takes as props.
 *
 * The bundle claim first, because it is the one a reachability walk is needed
 * for: the fetchers import the users module's *type* to keep the route literals
 * inferring, and a value import of the same module would drag Hono, Drizzle and
 * `@/database` into the browser bundle of every page that lists a device. That
 * is one character's difference in the source and several hundred kilobytes in
 * the output, which is exactly the kind of mistake review does not catch.
 *
 * The host-neutrality claim that used to sit beside it - reaches nothing from
 * `next/*`, from `next-intl`, from a server action - is now
 * `next-boundary.test.ts`'s, asserted over every file in the package rather than
 * over the six entry points listed here.
 */
const SHARED = {
  list: join(here, "devices-content.tsx"),
  query: join(here, "devices-query.ts"),
  revokeButton: join(here, "revoke-device-button.tsx"),
};

const withoutComments = (path: string): string =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

describe("the browser graph stops at the API's edge", () => {
  it("the query reaches neither Drizzle nor Hono", () => {
    const reached = [...externalGraph(SHARED.query).keys()];

    expect(reached).not.toContain("drizzle-orm");
    expect(reached.some(one => one.startsWith("hono"))).toBe(false);
  });

  it("walks far enough to have found them", () => {
    // Guards the guard: the assertion above is "found nothing", which a walk
    // that stopped at the entry file would satisfy completely.
    expect([...externalGraph(SHARED.list).keys()].length).toBeGreaterThan(2);
  });
});

describe("the shared list takes its framework parts as props", () => {
  it("is handed the devices rather than fetching them", () => {
    const code = withoutComments(SHARED.list);

    expect(code).toContain("devices: Device[];");
    expect(code).not.toContain("useQuery");
    expect(code).not.toContain("fetcher");
  });

  it("is handed the revoke rather than importing one", () => {
    expect(withoutComments(SHARED.list)).toContain("onRevoke: RevokeDevice;");
  });

  it("passes the revoke down to the button rather than the button finding it", () => {
    expect(withoutComments(SHARED.revokeButton)).toContain(
      "onRevoke: RevokeDevice;",
    );
  });
});
