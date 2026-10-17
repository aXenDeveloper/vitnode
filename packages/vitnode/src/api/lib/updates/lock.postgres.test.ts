import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { UpdateManifest } from "@/lib/updates/manifest";

import {
  core_update_lock,
  core_update_results,
  core_update_sources,
} from "@/database/updates";

import type { FetchUpdateSource } from "./check";
import type { UpdateComponent } from "./components";

import { checkForUpdates } from "./check";
import { UpdateSourceError } from "./fetch-source";
import {
  acquireUpdateCheckLease,
  releaseUpdateCheckLease,
  renewUpdateCheckLease,
  UPDATE_CHECK_LEASE_MS,
  UpdateCheckLeaseLostError,
  withUpdateCheckLease,
} from "./lock";

type Db = ReturnType<typeof drizzle>;

const URL_ENV = process.env.VITNODE_TEST_POSTGRES_URL;

const MIGRATION = resolve(
  import.meta.dirname,
  "../../../../../../apps/api/migrations/20261015193600_add_core_update_checks/migration.sql",
);

/**
 * `postgres://user@host:port/db`, or a unix socket directory given as
 * `postgres://user@/db?host=/tmp&port=5432`.
 */
const connectionOptions = (raw: string) => {
  // An empty host is how a socket URL is usually written, and `URL` rejects it.
  const url = new URL(raw.replace(/@\//, "@localhost/"));
  const param = (name: string) => url.searchParams.get(name);

  return {
    database: decodeURIComponent(url.pathname.slice(1)),
    host: param("host") ?? decodeURIComponent(url.hostname),
    password: url.password ? decodeURIComponent(url.password) : undefined,
    port: Number(param("port") ?? (url.port || 5432)),
    user: decodeURIComponent(url.username) || "postgres",
  };
};

const ACME = "https://acme.example.com/updates.json";
const T1 = new Date("2026-10-14T03:00:00Z");
const T2 = new Date("2026-10-15T03:00:00Z");

const BLOG: UpdateComponent = {
  hasUnknownVersion: false,
  id: "@acme/blog",
  kind: "plugin",
  sourceUrl: ACME,
  versions: ["1.0.0"],
};

const manifest = (stable: string): UpdateManifest => ({
  packages: {
    "@acme/blog": {
      channels: { stable },
      releases: { [stable]: {} },
      securityUpdates: [],
    },
  },
  schemaVersion: 1,
});

const answer =
  (result: Awaited<ReturnType<FetchUpdateSource>> | Error): FetchUpdateSource =>
  async () =>
    result instanceof Error
      ? await Promise.reject(result)
      : await Promise.resolve(result);

const fetched = (stable: string, etag: string) =>
  answer({ body: manifest(stable), etag, kind: "fetched", lastModified: null });

/** Resolves once `check` holds, polling the database every few milliseconds. */
const until = async (check: () => Promise<boolean>, timeoutMs = 2000) => {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("condition never held");
    await new Promise(next => setTimeout(next, 5));
  }
};

describe.skipIf(!URL_ENV)("update check lease on PostgreSQL", () => {
  const schema = `vitnode_lease_${randomUUID().replaceAll("-", "")}`;
  let client: postgres.Sql;
  let db: Db;

  const expire = async (owner: string) => {
    await db.execute(
      sql`update core_update_lock set "expiresAt" = timezone('utc', clock_timestamp()) - interval '1 second' where owner = ${owner}`,
    );
  };

  const stored = async () => ({
    results: await db
      .select()
      .from(core_update_results)
      .orderBy(core_update_results.componentId),
    sources: await db
      .select()
      .from(core_update_sources)
      .orderBy(core_update_sources.url),
  });

  const owner = async () =>
    (
      await db.select({ owner: core_update_lock.owner }).from(core_update_lock)
    )[0]?.owner;

  const check = async (
    leaseOwner: string,
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
      lease: { owner: leaseOwner, signal: new AbortController().signal },
      now,
    });

  beforeAll(async () => {
    const admin = postgres({
      ...connectionOptions(URL_ENV ?? ""),
      max: 1,
      onnotice: () => undefined,
    });
    await admin.unsafe(`create schema "${schema}"`);
    await admin.end();

    client = postgres({
      ...connectionOptions(URL_ENV ?? ""),
      connection: { search_path: schema },
      max: 6,
      onnotice: () => undefined,
    });
    db = drizzle({ client });
    for (const statement of readFileSync(MIGRATION, "utf8").split(
      "--> statement-breakpoint",
    )) {
      if (statement.trim()) await client.unsafe(statement);
    }
  });

  afterAll(async () => {
    if (!client) return;
    await client.unsafe(`drop schema if exists "${schema}" cascade`);
    await client.end();
  });

  beforeEach(async () => {
    await client.unsafe(
      "truncate core_update_lock, core_update_results, core_update_sources",
    );
  });

  it("lets exactly one of many concurrent instances take the lease", async () => {
    const owners = ["a", "b", "c", "d", "e"];

    const results = await Promise.all(
      owners.map(
        async name =>
          await acquireUpdateCheckLease(db, { manual: false, owner: name }),
      ),
    );

    const winners = results.flatMap(result =>
      result.acquired ? [result.owner] : [],
    );
    expect(winners).toHaveLength(1);
    expect(results.filter(result => !result.acquired)).toEqual(
      owners.slice(1).map(() => expect.objectContaining({ reason: "running" })),
    );
    await expect(owner()).resolves.toBe(winners[0]);
  });

  it("times the lease by the database clock in UTC, whatever the server's time zone", async () => {
    const before = Date.now();
    await acquireUpdateCheckLease(db, { manual: false, owner: "a" });

    const [row] = await db
      .select({ expiresAt: core_update_lock.expiresAt })
      .from(core_update_lock);

    expect(row?.expiresAt?.getTime()).toBeGreaterThanOrEqual(
      before + UPDATE_CHECK_LEASE_MS - 1000,
    );
    expect(row?.expiresAt?.getTime()).toBeLessThanOrEqual(
      Date.now() + UPDATE_CHECK_LEASE_MS + 1000,
    );
  });

  it("renews only for the owner, and never once its lease ran out", async () => {
    await acquireUpdateCheckLease(db, { manual: false, owner: "a" });

    await expect(renewUpdateCheckLease(db, "b")).resolves.toEqual({
      status: "lost",
    });
    await expect(renewUpdateCheckLease(db, "a")).resolves.toMatchObject({
      status: "renewed",
    });

    await expire("a");
    await expect(renewUpdateCheckLease(db, "a")).resolves.toEqual({
      status: "lost",
    });
  });

  it("holds a takeover back while the old owner's write is open, then fences the old owner", async () => {
    const events: string[] = [];
    await acquireUpdateCheckLease(db, {
      leaseMs: 50,
      manual: false,
      owner: "a",
    });
    let finishWrite = () => {};
    const writing = new Promise<void>(resolveWrite => {
      finishWrite = resolveWrite;
    });
    let insideWrite = () => {};
    const inside = new Promise<void>(resolveInside => {
      insideWrite = resolveInside;
    });

    const oldWrite = withUpdateCheckLease(db, "a", async tx => {
      await tx
        .insert(core_update_sources)
        .values({ lastAttemptAt: T1, url: ACME });
      insideWrite();
      await writing;
    }).then(() => events.push("a committed"));
    let takeover: ReturnType<typeof acquireUpdateCheckLease> | undefined;
    // A failed assertion must not leave a's transaction open for the next test.
    try {
      await inside;
      // Let a's lease run out by the database clock while its write is still open.
      await until(async () => {
        const rows = await db.execute<{ expired: boolean }>(
          sql`select "expiresAt" <= timezone('utc', clock_timestamp()) as expired from core_update_lock`,
        );

        return rows.some(row => row.expired);
      });

      takeover = acquireUpdateCheckLease(db, {
        manual: false,
        owner: "b",
      }).then(result => {
        events.push("b acquired");

        return result;
      });
      await until(async () => {
        const [row] = await db.execute<{ waiting: number }>(
          sql`select count(*)::int as waiting from pg_locks where locktype = 'advisory' and not granted`,
        );

        return row?.waiting === 1;
      });
      expect(events).toEqual([]);
    } finally {
      finishWrite();
    }
    await oldWrite;
    await expect(takeover).resolves.toEqual({ acquired: true, owner: "b" });
    expect(events).toEqual(["a committed", "b acquired"]);

    // What a committed while it held the lease stays; nothing after.
    await expect(
      withUpdateCheckLease(db, "a", async tx => {
        await tx.delete(core_update_sources);
      }),
    ).rejects.toBeInstanceOf(UpdateCheckLeaseLostError);
    expect((await stored()).sources).toMatchObject([{ url: ACME }]);
  });

  it.each([
    ["a fresh copy of a source", [BLOG], fetched("1.2.0", '"v2"')],
    ["a failed request", [BLOG], answer(new UpdateSourceError("timeout"))],
    ["the clean-up", [{ ...BLOG, sourceUrl: null }], answer(new Error("no"))],
  ])(
    "refuses %s from an owner whose lease was taken over",
    async (_, components, fetchSource) => {
      await acquireUpdateCheckLease(db, { manual: false, owner: "a" });
      await check("a", [BLOG], fetched("1.1.0", '"v1"'));
      const before = await stored();
      await expire("a");
      await acquireUpdateCheckLease(db, { manual: false, owner: "b" });

      await expect(
        check("a", components, fetchSource, T2),
      ).rejects.toBeInstanceOf(UpdateCheckLeaseLostError);
      await expect(stored()).resolves.toEqual(before);
    },
  );

  it("lets the owner that holds the lease write and clean up as usual", async () => {
    await acquireUpdateCheckLease(db, { manual: false, owner: "b" });
    await check("b", [BLOG], fetched("1.1.0", '"v1"'));
    await check("b", [BLOG], fetched("1.2.0", '"v2"'), T2);

    expect(await stored()).toMatchObject({
      results: [
        {
          componentId: "@acme/blog",
          lastSuccessAt: T2,
          result: { latest: { version: "1.2.0" }, status: "update_available" },
        },
      ],
      sources: [{ etag: '"v2"', lastSuccessAt: T2, url: ACME }],
    });

    await check("b", [{ ...BLOG, sourceUrl: null }], answer(new Error("no")));
    await expect(stored()).resolves.toEqual({ results: [], sources: [] });
  });

  it("never frees a replacement owner's lease", async () => {
    await acquireUpdateCheckLease(db, { manual: false, owner: "a" });
    await expire("a");
    await acquireUpdateCheckLease(db, { manual: false, owner: "b" });

    await expect(releaseUpdateCheckLease(db, "a")).resolves.toBe(false);
    await expect(owner()).resolves.toBe("b");
    await expect(releaseUpdateCheckLease(db, "b")).resolves.toBe(true);
    await expect(owner()).resolves.toBeNull();
  });
});
