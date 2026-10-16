import type { drizzle } from "drizzle-orm/postgres-js";

import { describe, expect, it, vi } from "vitest";

import type { UpdateManifest } from "@/lib/updates/manifest";

import { core_update_results, core_update_sources } from "@/database/updates";
import { createMemoryDb } from "@/tests/memory-db";

import type { FetchUpdateSource } from "./check";
import type { UpdateComponent } from "./components";

import { checkForUpdates, runLockedUpdateCheck } from "./check";
import { UpdateSourceError } from "./fetch-source";
import { acquireUpdateCheckLease, readUpdateCheckLock } from "./lock";

type Db = ReturnType<typeof drizzle>;

const ACME = "https://acme.example.com/updates.json";
const CORE = "https://vitnode.example.com/updates.json";

const T1 = new Date("2026-10-14T03:00:00Z");
const T2 = new Date("2026-10-15T03:00:00Z");

const component = (
  id: string,
  sourceUrl: null | string,
  versions: string[] = ["1.0.0"],
): UpdateComponent => ({
  hasUnknownVersion: false,
  id,
  kind: id === "@vitnode/core" ? "core" : "plugin",
  sourceUrl,
  versions,
});

const SECURITY_UPDATE = {
  affected: "<1.1.0",
  fixed: "1.1.0",
  id: "ACME-1",
  url: "https://acme.example.com/advisories/1",
};

const acmeManifest = (
  ids: string[] = ["@acme/blog", "@acme/forum"],
): UpdateManifest => ({
  packages: Object.fromEntries(
    ids.map(id => [
      id,
      {
        securityUpdates: [SECURITY_UPDATE],
        channels: { stable: "1.1.0" },
        releases: { "1.1.0": {} },
      },
    ]),
  ),
  schemaVersion: 1,
});

const coreManifest: UpdateManifest = {
  packages: {
    "@vitnode/core": {
      securityUpdates: [],
      channels: { stable: "2.0.0" },
      releases: { "2.0.0": {} },
    },
  },
  schemaVersion: 1,
};

const fetched = (body: unknown, etag: null | string = null) => ({
  body,
  etag,
  kind: "fetched" as const,
  lastModified: null,
});

/** Answers per URL; a function answer can look at what was asked. */
const sources = (
  answers: Record<
    string,
    | ((
        options: Parameters<FetchUpdateSource>[1],
      ) => Awaited<ReturnType<FetchUpdateSource>>)
    | Awaited<ReturnType<FetchUpdateSource>>
    | Error
  >,
) =>
  vi.fn<FetchUpdateSource>(async (url, options) => {
    const answer = answers[url];
    if (answer === undefined) throw new Error(`unexpected fetch of ${url}`);
    if (answer instanceof Error) throw answer;

    return await Promise.resolve(
      typeof answer === "function" ? answer(options) : answer,
    );
  });

const setup = () => {
  const memory = createMemoryDb();
  const db = memory.db as unknown as Db;
  const check = async (
    components: UpdateComponent[],
    fetchSource: FetchUpdateSource,
    now = T1,
  ) =>
    await checkForUpdates({
      channelOverride: null,
      components,
      coreVersion: "2.0.0",
      db,
      fetchSource,
      now,
    });
  const result = (id: string) =>
    memory.rows(core_update_results).find(row => row.componentId === id);
  const source = (url: string) =>
    memory.rows(core_update_sources).find(row => row.url === url);

  return { check, db, memory, result, source };
};

const BLOG = component("@acme/blog", ACME);
const FORUM = component("@acme/forum", ACME, ["1.1.0"]);

describe("checkForUpdates", () => {
  it("fetches a source shared by several plugins once, and evaluates each", async () => {
    const { check, result } = setup();
    const fetchSource = sources({ [ACME]: fetched(acmeManifest()) });

    const summary = await check([BLOG, FORUM], fetchSource);

    expect(fetchSource).toHaveBeenCalledTimes(1);
    expect(summary).toEqual({
      securityUpdates: 1,
      components: 2,
      failedSources: 0,
      sources: 1,
      updates: 1,
    });
    expect(result("@acme/blog")).toMatchObject({
      lastError: null,
      lastSuccessAt: T1,
      result: {
        securityUpdates: [{ id: "ACME-1" }],
        status: "update_available",
      },
      sourceUrl: ACME,
      versions: ["1.0.0"],
    });
    expect(result("@acme/forum")).toMatchObject({
      result: { securityUpdates: [], status: "up_to_date" },
    });
  });

  it("stores only the packages this install checks", async () => {
    const { check, source } = setup();

    await check([BLOG], sources({ [ACME]: fetched(acmeManifest(), '"v1"') }));

    expect(source(ACME)).toMatchObject({ etag: '"v1"', lastError: null });
    expect(source(ACME)?.document).toEqual({
      packages: { "@acme/blog": expect.any(Object) as unknown },
      schemaVersion: 1,
    });
  });

  it("skips a component without an update source", async () => {
    const { check, result } = setup();
    const fetchSource = sources({});

    await expect(
      check([component("@acme/local", null)], fetchSource),
    ).resolves.toMatchObject({ components: 0, sources: 0 });
    expect(fetchSource).not.toHaveBeenCalled();
    expect(result("@acme/local")).toBeUndefined();
  });

  it("keeps one failing source from affecting the others", async () => {
    const { check, result } = setup();
    const core = component("@vitnode/core", CORE, ["1.9.0"]);

    const summary = await check(
      [core, BLOG],
      sources({
        [ACME]: new UpdateSourceError("timeout"),
        [CORE]: fetched(coreManifest),
      }),
    );

    expect(summary).toMatchObject({ failedSources: 1, sources: 2, updates: 1 });
    expect(result("@vitnode/core")).toMatchObject({
      lastError: null,
      result: { status: "update_available" },
    });
    expect(result("@acme/blog")).toMatchObject({
      lastError: { code: "timeout", detail: null },
      result: null,
    });
  });

  it.each([
    [
      "an unreachable source",
      new UpdateSourceError("http_error", "503"),
      { code: "http_error", detail: "503" },
    ],
    [
      "a crash in the transport",
      new Error("socket hang up"),
      { code: "network", detail: null },
    ],
    [
      "an invalid manifest",
      fetched({ packages: [], schemaVersion: 1 }),
      { code: "invalid_manifest" },
    ],
    [
      "a manifest from a newer VitNode",
      fetched({ schemaVersion: 2 }),
      { code: "unsupported_schema" },
    ],
  ])("keeps the previous findings through %s", async (_, answer, error) => {
    const { check, result, source } = setup();
    await check([BLOG], sources({ [ACME]: fetched(acmeManifest()) }), T1);

    await check([BLOG], sources({ [ACME]: answer }), T2);

    expect(result("@acme/blog")).toMatchObject({
      lastAttemptAt: T2,
      lastError: error,
      lastSuccessAt: T1,
      result: {
        securityUpdates: [{ id: "ACME-1" }],
        status: "update_available",
      },
    });
    expect(source(ACME)).toMatchObject({
      document: { packages: { "@acme/blog": {} } },
      lastAttemptAt: T2,
      lastError: error,
      lastSuccessAt: T1,
    });
  });

  it("answers a 304 from the stored copy, evaluated for what runs now", async () => {
    const { check, result } = setup();
    await check(
      [BLOG],
      sources({ [ACME]: fetched(acmeManifest(), '"v1"') }),
      T1,
    );
    const fetchSource = sources({ [ACME]: { kind: "not_modified" } });

    await check([component("@acme/blog", ACME, ["1.1.0"])], fetchSource, T2);

    expect(fetchSource).toHaveBeenCalledWith(ACME, {
      validators: { etag: '"v1"', lastModified: null },
    });
    expect(result("@acme/blog")).toMatchObject({
      lastError: null,
      lastSuccessAt: T2,
      result: { securityUpdates: [], status: "up_to_date" },
      versions: ["1.1.0"],
    });
  });

  it("asks for the full document when the stored copy does not cover a new plugin", async () => {
    const { check, result } = setup();
    await check(
      [BLOG],
      sources({ [ACME]: fetched(acmeManifest(), '"v1"') }),
      T1,
    );
    const fetchSource = sources({ [ACME]: { kind: "not_modified" } });

    await check([BLOG, FORUM], fetchSource, T2);

    expect(fetchSource).toHaveBeenCalledWith(ACME, { validators: null });
    expect(result("@acme/forum")).toMatchObject({
      lastError: { code: "http_error" },
      result: null,
    });
  });

  it("forgets removed plugins and sources nothing points to", async () => {
    const { check, memory } = setup();
    const core = component("@vitnode/core", CORE, ["2.0.0"]);
    await check(
      [core, BLOG],
      sources({
        [ACME]: fetched(acmeManifest()),
        [CORE]: fetched(coreManifest),
      }),
      T1,
    );

    await check([core], sources({ [CORE]: fetched(coreManifest) }), T2);

    expect(
      memory.rows(core_update_results).map(row => row.componentId),
    ).toEqual(["@vitnode/core"]);
    expect(memory.rows(core_update_sources).map(row => row.url)).toEqual([
      CORE,
    ]);
  });

  it("forgets everything when nothing has an update source any more", async () => {
    const { check, memory } = setup();
    await check([BLOG], sources({ [ACME]: fetched(acmeManifest()) }), T1);

    await check([component("@acme/blog", null)], sources({}), T2);

    expect(memory.rows(core_update_results)).toEqual([]);
    expect(memory.rows(core_update_sources)).toEqual([]);
  });
});

describe("runLockedUpdateCheck", () => {
  const options = (db: Db, fetchSource: FetchUpdateSource) => ({
    channelOverride: null,
    components: [BLOG],
    coreVersion: "2.0.0",
    db,
    fetchSource,
    now: T1,
  });

  it("does not check while another instance holds the lease", async () => {
    const { db } = setup();
    await acquireUpdateCheckLease(db, {
      manual: false,
      now: T1,
      owner: "other",
    });
    const fetchSource = sources({});

    await expect(
      runLockedUpdateCheck({ ...options(db, fetchSource), manual: true }),
    ).resolves.toMatchObject({ reason: "running", status: "busy" });
    expect(fetchSource).not.toHaveBeenCalled();
  });

  it("gives the lease back after the check, even when it throws", async () => {
    const { db } = setup();
    const failingDb = new Proxy(db, {
      get: (target, property, receiver) =>
        property === "delete"
          ? () => {
              throw new Error("database went away");
            }
          : (Reflect.get(target, property, receiver) as unknown),
    });

    await expect(
      runLockedUpdateCheck({
        ...options(failingDb, sources({ [ACME]: fetched(acmeManifest()) })),
        manual: false,
      }),
    ).rejects.toThrow("database went away");
    await expect(readUpdateCheckLock(db, T1)).resolves.toMatchObject({
      running: false,
    });
  });

  it("returns the summary of a completed check", async () => {
    const { db } = setup();

    await expect(
      runLockedUpdateCheck({
        ...options(db, sources({ [ACME]: fetched(acmeManifest()) })),
        manual: false,
      }),
    ).resolves.toMatchObject({
      status: "completed",
      summary: { sources: 1, updates: 1 },
    });
  });
});
