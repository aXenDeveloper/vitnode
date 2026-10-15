import type { drizzle } from "drizzle-orm/postgres-js";

import { describe, expect, it } from "vitest";

import type { UpdateChannel, UpdateManifest } from "@/lib/updates/manifest";

import { createMemoryDb } from "@/tests/memory-db";

import type { UpdateComponent } from "./components";

import { checkForUpdates } from "./check";
import { UpdateSourceError } from "./fetch-source";
import { acquireUpdateCheckLease } from "./lock";
import { loadUpdatesOverview } from "./status";

type Db = ReturnType<typeof drizzle>;

const ACME = "https://acme.example.com/updates.json";
const T1 = new Date("2026-10-14T03:00:00Z");
const T2 = new Date("2026-10-15T03:00:00Z");

const MANIFEST: UpdateManifest = {
  packages: {
    "@acme/blog": {
      advisories: [
        {
          affected: "<1.1.0",
          fixed: "1.1.0",
          id: "ACME-1",
          severity: "high",
          url: "https://acme.example.com/advisories/1",
        },
      ],
      channels: { canary: "1.2.0-canary.1", stable: "1.1.0" },
      releases: { "1.1.0": {}, "1.2.0-canary.1": {} },
    },
  },
  schemaVersion: 1,
};

const blog = (overrides: Partial<UpdateComponent> = {}): UpdateComponent => ({
  hasUnknownVersion: false,
  id: "@acme/blog",
  kind: "plugin",
  sourceUrl: ACME,
  versions: ["1.0.0"],
  ...overrides,
});

/** A database holding one successful check of `blog()` on core 2.0.0. */
const checked = async () => {
  const db = createMemoryDb().db as unknown as Db;
  await checkForUpdates({
    channelOverride: null,
    components: [blog()],
    coreVersion: "2.0.0",
    db,
    fetchSource: async () =>
      await Promise.resolve({
        body: MANIFEST,
        etag: null,
        kind: "fetched" as const,
        lastModified: null,
      }),
    now: T1,
  });

  return db;
};

const overview = async (
  db: Db,
  {
    channelOverride = null,
    components = [blog()],
    coreVersion = "2.0.0",
    enabled = true,
  }: {
    channelOverride?: null | UpdateChannel;
    components?: UpdateComponent[];
    coreVersion?: string;
    enabled?: boolean;
  } = {},
) =>
  await loadUpdatesOverview({
    channelOverride,
    components,
    coreVersion,
    db,
    enabled,
    now: T2,
  });

describe("loadUpdatesOverview", () => {
  it("shows the stored result while nothing changed", async () => {
    const db = await checked();

    const { components } = await overview(db);

    expect(components).toEqual([
      {
        id: "@acme/blog",
        lastAttemptAt: T1,
        lastError: null,
        lastSuccessAt: T1,
        result: expect.objectContaining({
          advisories: [expect.objectContaining({ id: "ACME-1" })],
          status: "update_available",
        }) as unknown,
        sourceUrl: ACME,
        stale: false,
        state: "checked",
      },
    ]);
  });

  it("re-evaluates a redeployed plugin from the stored manifest and marks it stale", async () => {
    const db = await checked();

    const [state] = (
      await overview(db, { components: [blog({ versions: ["1.1.0"] })] })
    ).components;

    expect(state).toMatchObject({
      lastSuccessAt: T1,
      result: { advisories: [], status: "up_to_date" },
      stale: true,
      state: "checked",
    });
  });

  it.each([
    ["the channel changed", { channelOverride: "canary" as const }],
    ["core was upgraded", { coreVersion: "2.1.0" }],
    [
      "a side lost its version",
      { components: [blog({ hasUnknownVersion: true })] },
    ],
  ])("marks the result stale when %s", async (_, change) => {
    const db = await checked();

    const [state] = (await overview(db, change)).components;

    expect(state?.stale).toBe(true);
  });

  it("does not reuse a result checked against another update source", async () => {
    const db = await checked();

    const [state] = (
      await overview(db, {
        components: [
          blog({ sourceUrl: "https://elsewhere.example.com/u.json" }),
        ],
      })
    ).components;

    expect(state).toMatchObject({
      result: null,
      stale: false,
      state: "not_checked",
    });
  });

  it("keeps the previous result next to a failed check", async () => {
    const db = await checked();
    await checkForUpdates({
      channelOverride: null,
      components: [blog()],
      coreVersion: "2.0.0",
      db,
      fetchSource: async () =>
        await Promise.reject(new UpdateSourceError("timeout")),
      now: T2,
    });

    const [state] = (await overview(db)).components;

    expect(state).toMatchObject({
      lastAttemptAt: T2,
      lastError: { code: "timeout" },
      lastSuccessAt: T1,
      result: { advisories: [{ id: "ACME-1" }] },
      stale: false,
      state: "checked",
    });
  });

  it.each([
    [
      "a component without an update source",
      blog({ sourceUrl: null }),
      "unavailable",
    ],
    ["a component never checked", blog({ id: "@acme/forum" }), "not_checked"],
  ])("shows %s as such", async (_, component, state) => {
    const db = await checked();

    const [entry] = (await overview(db, { components: [component] }))
      .components;

    expect(entry).toMatchObject({ result: null, state });
  });

  it("shows nothing as checkable while checks are turned off", async () => {
    const db = await checked();

    const result = await overview(db, { enabled: false });

    expect(result).toMatchObject({
      components: [{ result: null, state: "unavailable" }],
      enabled: false,
    });
  });

  it("reports a running check and the last manual one", async () => {
    const db = await checked();
    await acquireUpdateCheckLease(db, { manual: true, now: T2, owner: "a" });

    await expect(overview(db)).resolves.toMatchObject({
      lastManualAt: T2,
      running: true,
    });
  });
});
