import type { drizzle } from "drizzle-orm/postgres-js";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { UpdateChannel, UpdateManifest } from "@/lib/updates/manifest";

import { createMemoryDb } from "@/tests/memory-db";

import type { UpdateComponent } from "./components";
import type { UpdateEvaluation } from "./evaluate";
import type { ComponentUpdateState, UpdatesOverview } from "./status";

import { checkForUpdates } from "./check";
import { UpdateSourceError } from "./fetch-source";
import { acquireUpdateCheckLease, releaseUpdateCheckLease } from "./lock";
import { loadUpdatesOverview, summarizeUpdates } from "./status";

type Db = ReturnType<typeof drizzle>;

const ACME = "https://acme.example.com/updates.json";
const T1 = new Date("2026-10-14T03:00:00Z");
const T2 = new Date("2026-10-15T03:00:00Z");

const MANIFEST: UpdateManifest = {
  packages: {
    "@acme/blog": {
      securityUpdates: [
        {
          affected: "<1.1.0",
          fixed: "1.1.0",
          id: "ACME-1",
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

const OWNER = "check";

const leased = async (
  db: Db,
  options: Omit<Parameters<typeof checkForUpdates>[0], "db" | "lease">,
) => {
  await acquireUpdateCheckLease(db, { manual: false, owner: OWNER });
  await checkForUpdates({
    ...options,
    db,
    lease: { owner: OWNER, signal: new AbortController().signal },
  });
  await releaseUpdateCheckLease(db, OWNER);
};

/** A database holding one successful check of `blog()` on core 2.0.0. */
const checked = async () => {
  const db = createMemoryDb().db as unknown as Db;
  await leased(db, {
    channelOverride: null,
    components: [blog()],
    coreVersion: "2.0.0",
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
  });

describe("loadUpdatesOverview", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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
          securityUpdates: [expect.objectContaining({ id: "ACME-1" })],
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
      result: { securityUpdates: [], status: "up_to_date" },
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
    await leased(db, {
      channelOverride: null,
      components: [blog()],
      coreVersion: "2.0.0",
      fetchSource: async () =>
        await Promise.reject(new UpdateSourceError("timeout")),
      now: T2,
    });

    const [state] = (await overview(db)).components;

    expect(state).toMatchObject({
      lastAttemptAt: T2,
      lastError: { code: "timeout" },
      lastSuccessAt: T1,
      result: { securityUpdates: [{ id: "ACME-1" }] },
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
    vi.useFakeTimers({ now: T2, toFake: ["Date"] });
    await acquireUpdateCheckLease(db, { manual: true, owner: "a" });

    await expect(overview(db)).resolves.toMatchObject({
      lastManualAt: T2,
      running: true,
    });
  });
});

describe("summarizeUpdates", () => {
  const advisory = (id: string) => ({
    affected: "<9.0.0",
    fixed: "9.0.0",
    id,
    url: `https://example.com/advisories/${id}`,
    versions: ["1.0.0"],
  });

  const evaluation = (
    status: UpdateEvaluation["status"],
    securityUpdates: UpdateEvaluation["securityUpdates"] = [],
    latest: null | string = status === "update_available" ? "9.0.0" : null,
  ): UpdateEvaluation => ({
    alternative: null,
    channel: "stable",
    compatibility: null,
    latest:
      latest === null
        ? null
        : { publishedAt: null, requiresCore: null, url: null, version: latest },
    securityUpdates,
    status,
  });

  const state = (
    id: string,
    overrides: Partial<ComponentUpdateState> = {},
  ): ComponentUpdateState => ({
    id,
    lastAttemptAt: T1,
    lastError: null,
    lastSuccessAt: T1,
    result: evaluation("up_to_date"),
    sourceUrl: ACME,
    stale: false,
    state: "checked",
    ...overrides,
  });

  const summarize = (
    components: ComponentUpdateState[],
    overrides: Partial<UpdatesOverview> = {},
  ) =>
    summarizeUpdates({
      channelOverride: null,
      components,
      enabled: true,
      lastManualAt: null,
      running: false,
      ...overrides,
    });

  it("counts each component once, whatever it has to report", () => {
    const summary = summarize([
      state("@vitnode/core", {
        result: evaluation("update_available", [advisory("CORE-1")], "2.1.0"),
      }),
      state("@acme/blog", {
        result: evaluation("update_available", [
          advisory("ACME-1"),
          advisory("ACME-2"),
        ]),
      }),
      state("@acme/forum", { result: evaluation("update_available") }),
      state("@acme/wiki"),
    ]);

    expect(summary).toMatchObject({
      affectedComponents: 2,
      checkedComponents: 4,
      core: { latestVersion: "2.1.0" },
      pluginUpdatesAvailable: 2,
      totalComponents: 4,
      unconfirmedComponents: 0,
      updatesAvailable: 3,
    });
  });

  it("tells a stale, failed or never checked component from a confirmed one", () => {
    const summary = summarize([
      state("@vitnode/core", { lastAttemptAt: T2 }),
      state("@acme/blog", {
        lastAttemptAt: T2,
        lastError: { code: "timeout", detail: null },
        result: evaluation("update_available", [advisory("ACME-1")]),
      }),
      state("@acme/forum", { stale: true }),
      state("@acme/wiki", {
        lastAttemptAt: null,
        lastSuccessAt: null,
        result: null,
        state: "not_checked",
      }),
      state("@acme/local", {
        lastAttemptAt: null,
        lastSuccessAt: null,
        result: null,
        sourceUrl: null,
        state: "unavailable",
      }),
      state("@acme/odd", { result: evaluation("version_unknown") }),
    ]);

    expect(summary).toMatchObject({
      affectedComponents: 1,
      checkedComponents: 4,
      core: { latestVersion: null },
      failedComponents: 1,
      lastAttemptAt: T2,
      notCheckedComponents: 1,
      oldestSuccessAt: null,
      stale: true,
      totalComponents: 6,
      unconfirmedComponents: 3,
    });
  });

  it("dates the summary by the oldest success once every checkable component has one", () => {
    const summary = summarize([
      state("@vitnode/core", { lastSuccessAt: T2 }),
      state("@acme/blog", { lastSuccessAt: T1 }),
      state("@acme/local", {
        lastSuccessAt: null,
        result: null,
        state: "unavailable",
      }),
    ]);

    expect(summary.oldestSuccessAt).toEqual(T1);
  });
});
