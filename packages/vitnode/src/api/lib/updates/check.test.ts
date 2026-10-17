import type { drizzle } from "drizzle-orm/postgres-js";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { UpdateManifest } from "@/lib/updates/manifest";

import {
  core_update_lock,
  core_update_results,
  core_update_sources,
} from "@/database/updates";
import { createMemoryDb } from "@/tests/memory-db";

import type { FetchUpdateSource } from "./check";
import type { UpdateComponent } from "./components";

import { checkForUpdates, runLockedUpdateCheck } from "./check";
import { UpdateSourceError } from "./fetch-source";
import {
  acquireUpdateCheckLease,
  readUpdateCheckLock,
  releaseUpdateCheckLease,
  UPDATE_CHECK_LEASE_MS,
  UpdateCheckLeaseLostError,
} from "./lock";

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

const OWNER = "run";

const setup = async () => {
  const memory = createMemoryDb();
  const db = memory.db as unknown as Db;
  await acquireUpdateCheckLease(db, { manual: false, owner: OWNER });
  const lost = new AbortController();
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
      lease: { owner: OWNER, signal: lost.signal },
      now,
    });
  const result = (id: string) =>
    memory.rows(core_update_results).find(row => row.componentId === id);
  const source = (url: string) =>
    memory.rows(core_update_sources).find(row => row.url === url);
  const stored = () => ({
    results: memory.rows(core_update_results),
    sources: memory.rows(core_update_sources),
  });

  return { check, db, lost, memory, result, source, stored };
};

const BLOG = component("@acme/blog", ACME);
const FORUM = component("@acme/forum", ACME, ["1.1.0"]);

describe("checkForUpdates", () => {
  it("fetches a source shared by several plugins once, and evaluates each", async () => {
    const { check, result } = await setup();
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
    const { check, source } = await setup();

    await check([BLOG], sources({ [ACME]: fetched(acmeManifest(), '"v1"') }));

    expect(source(ACME)).toMatchObject({ etag: '"v1"', lastError: null });
    expect(source(ACME)?.document).toEqual({
      packages: { "@acme/blog": expect.any(Object) as unknown },
      schemaVersion: 1,
    });
  });

  it("skips a component without an update source", async () => {
    const { check, result } = await setup();
    const fetchSource = sources({});

    await expect(
      check([component("@acme/local", null)], fetchSource),
    ).resolves.toMatchObject({ components: 0, sources: 0 });
    expect(fetchSource).not.toHaveBeenCalled();
    expect(result("@acme/local")).toBeUndefined();
  });

  it("keeps one failing source from affecting the others", async () => {
    const { check, result } = await setup();
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
    const { check, result, source } = await setup();
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
    const { check, result } = await setup();
    await check(
      [BLOG],
      sources({ [ACME]: fetched(acmeManifest(), '"v1"') }),
      T1,
    );
    const fetchSource = sources({ [ACME]: { kind: "not_modified" } });

    await check([component("@acme/blog", ACME, ["1.1.0"])], fetchSource, T2);

    expect(fetchSource).toHaveBeenCalledWith(ACME, {
      signal: expect.any(AbortSignal) as unknown,
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
    const { check, result } = await setup();
    await check(
      [BLOG],
      sources({ [ACME]: fetched(acmeManifest(), '"v1"') }),
      T1,
    );
    const fetchSource = sources({ [ACME]: { kind: "not_modified" } });

    await check([BLOG, FORUM], fetchSource, T2);

    expect(fetchSource).toHaveBeenCalledWith(ACME, {
      signal: expect.any(AbortSignal) as unknown,
      validators: null,
    });
    expect(result("@acme/forum")).toMatchObject({
      lastError: { code: "http_error" },
      result: null,
    });
  });

  it("forgets removed plugins and sources nothing points to", async () => {
    const { check, memory } = await setup();
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
    const { check, memory } = await setup();
    await check([BLOG], sources({ [ACME]: fetched(acmeManifest()) }), T1);

    await check([component("@acme/blog", null)], sources({}), T2);

    expect(memory.rows(core_update_results)).toEqual([]);
    expect(memory.rows(core_update_sources)).toEqual([]);
  });
});

const untilAborted: FetchUpdateSource = async (_, { signal }) =>
  await new Promise((_resolve, reject) => {
    signal?.addEventListener("abort", () => {
      reject(signal.reason as Error);
    });
  });

describe("checkForUpdates once the lease is lost", () => {
  const url = (index: number) => `https://p${index}.example.com/updates.json`;

  it("aborts requests in flight, never starts queued ones, and stores nothing", async () => {
    const { check, lost, stored } = await setup();
    await check([BLOG], sources({ [ACME]: fetched(acmeManifest()) }));
    const before = stored();
    const signals: AbortSignal[] = [];
    let answerLate: (
      value: Awaited<ReturnType<FetchUpdateSource>>,
    ) => void = () => undefined;
    const fetchSource = vi.fn<FetchUpdateSource>(async (requested, options) => {
      if (options.signal) signals.push(options.signal);
      if (requested === ACME) {
        return await new Promise(resolve => {
          answerLate = resolve;
        });
      }

      return await untilAborted(requested, options);
    });
    const running = check(
      [
        BLOG,
        ...[1, 2, 3, 4, 5].map(index => component(`@p/${index}`, url(index))),
      ],
      fetchSource,
      T2,
    );
    let settled = false;
    void running.catch(() => undefined).finally(() => (settled = true));
    await vi.waitFor(() => {
      expect(signals).toHaveLength(4);
    });

    lost.abort(new UpdateCheckLeaseLostError());
    await new Promise(resolve => setImmediate(resolve));
    expect(signals.every(signal => signal.aborted)).toBe(true);
    expect(settled).toBe(false);
    answerLate(fetched(acmeManifest(), '"v2"'));

    await expect(running).rejects.toBeInstanceOf(UpdateCheckLeaseLostError);
    expect(fetchSource).toHaveBeenCalledTimes(4);
    expect(stored()).toEqual(before);
  });

  it.each([
    [
      "a fresh copy of a source",
      [BLOG],
      sources({ [ACME]: fetched(acmeManifest(["@acme/blog"]), '"v2"') }),
    ],
    [
      "a failed request",
      [BLOG],
      sources({ [ACME]: new UpdateSourceError("timeout") }),
    ],
    ["the clean-up", [component("@acme/blog", null)], sources({})],
  ])(
    "refuses %s from a run whose lease was taken over before it noticed",
    async (_, components, fetchSource) => {
      const { check, db, memory, stored } = await setup();
      await check([BLOG], sources({ [ACME]: fetched(acmeManifest()) }));
      const before = stored();
      await releaseUpdateCheckLease(db, OWNER);
      await acquireUpdateCheckLease(db, { manual: false, owner: "other" });

      await expect(check(components, fetchSource, T2)).rejects.toBeInstanceOf(
        UpdateCheckLeaseLostError,
      );
      expect(stored()).toEqual(before);
      expect(memory.rows(core_update_lock)).toMatchObject([{ owner: "other" }]);
    },
  );
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

  const unleased = () => {
    const memory = createMemoryDb();

    return { db: memory.db as unknown as Db, memory };
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not check while another instance holds the lease", async () => {
    const { db } = unleased();
    await acquireUpdateCheckLease(db, { manual: false, owner: "other" });
    const fetchSource = sources({});

    await expect(
      runLockedUpdateCheck({ ...options(db, fetchSource), manual: true }),
    ).resolves.toMatchObject({ reason: "running", status: "busy" });
    expect(fetchSource).not.toHaveBeenCalled();
  });

  it("gives the lease back after the check, even when it throws", async () => {
    const { db } = unleased();
    const failingDb = new Proxy(db, {
      get: (target, property, receiver) =>
        property === "transaction"
          ? async (run: (tx: unknown) => Promise<unknown>) =>
              await target.transaction(
                async tx =>
                  await run(
                    new Proxy(tx, {
                      get: (inner, name, innerReceiver) =>
                        name === "delete"
                          ? () => {
                              throw new Error("database went away");
                            }
                          : (Reflect.get(
                              inner,
                              name,
                              innerReceiver,
                            ) as unknown),
                    }),
                  ),
              )
          : (Reflect.get(target, property, receiver) as unknown),
    });

    await expect(
      runLockedUpdateCheck({
        ...options(failingDb, sources({ [ACME]: fetched(acmeManifest()) })),
        manual: false,
      }),
    ).rejects.toThrow("database went away");
    await expect(readUpdateCheckLock(db)).resolves.toMatchObject({
      running: false,
    });
  });

  it("returns the summary of a completed check", async () => {
    const { db } = unleased();

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

  it("keeps a check that outlasts the first lease protected by renewing it", async () => {
    vi.useFakeTimers({ now: T1 });
    const { db, memory } = unleased();
    let answer: (value: Awaited<ReturnType<FetchUpdateSource>>) => void = () =>
      undefined;
    const fetchSource = vi.fn<FetchUpdateSource>(
      async () =>
        await new Promise(resolve => {
          answer = resolve;
        }),
    );
    const running = runLockedUpdateCheck({
      ...options(db, fetchSource),
      manual: false,
    });

    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_LEASE_MS + 60_000);
    await expect(
      acquireUpdateCheckLease(db, { manual: false, owner: "other" }),
    ).resolves.toMatchObject({ acquired: false, reason: "running" });

    answer(fetched(acmeManifest()));
    await expect(running).resolves.toMatchObject({ status: "completed" });
    expect(memory.rows(core_update_results)).toHaveLength(1);
    await expect(readUpdateCheckLock(db)).resolves.toMatchObject({
      running: false,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops when a renewal fails, keeping what it stored before", async () => {
    vi.useFakeTimers({ now: T1 });
    const { db, memory } = unleased();
    let offline = false;
    const flakyDb = new Proxy(db, {
      get: (target, property, receiver) =>
        property === "transaction" && offline
          ? async () => await Promise.reject(new Error("connection reset"))
          : (Reflect.get(target, property, receiver) as unknown),
    });
    const fetchSource = vi.fn<FetchUpdateSource>(untilAborted);
    const running = runLockedUpdateCheck({
      ...options(flakyDb, fetchSource),
      manual: false,
    });
    await vi.waitFor(() => {
      expect(fetchSource).toHaveBeenCalled();
    });

    offline = true;
    await vi.advanceTimersByTimeAsync(60_000);

    await expect(running).resolves.toEqual({ status: "lease_lost" });
    expect(fetchSource.mock.calls[0]?.[1].signal?.aborted).toBe(true);
    expect(memory.rows(core_update_results)).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops once another instance holds the lease, and leaves that lease alone", async () => {
    vi.useFakeTimers({ now: T1 });
    const { db, memory } = unleased();
    const fetchSource = vi.fn<FetchUpdateSource>(untilAborted);
    const running = runLockedUpdateCheck({
      ...options(db, fetchSource),
      manual: false,
    });
    await vi.waitFor(() => {
      expect(fetchSource).toHaveBeenCalled();
    });

    const [{ owner }] = memory.rows(core_update_lock) as [{ owner: string }];
    await releaseUpdateCheckLease(db, owner);
    await acquireUpdateCheckLease(db, { manual: false, owner: "other" });
    await vi.advanceTimersByTimeAsync(60_000);

    await expect(running).resolves.toEqual({ status: "lease_lost" });
    expect(memory.rows(core_update_lock)).toMatchObject([{ owner: "other" }]);
    expect(memory.rows(core_update_results)).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
