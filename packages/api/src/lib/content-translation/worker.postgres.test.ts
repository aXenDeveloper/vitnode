import type { Context } from "hono";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { PostgresTestSchema } from "@/tests/postgres";

import { core_content_ai_translation_jobs } from "@/database/content-translations";
import { createPostgresTestSchema, POSTGRES_TEST_URL } from "@/tests/postgres";

import { claimJob, finishJob } from "./worker";

const jobs = core_content_ai_translation_jobs;

describe.skipIf(!POSTGRES_TEST_URL)(
  "translation job leases on PostgreSQL",
  () => {
    let schema: PostgresTestSchema;
    let db: Context["var"]["db"];
    let records = 0;

    const insertJob = async (
      values: Partial<typeof jobs.$inferInsert> = {},
    ) => {
      records++;
      const [row] = await schema.db
        .insert(jobs)
        .values({
          contentTypeId: "@vitnode/forum:topic",
          field: "body",
          recordId: String(records),
          sourceFingerprint: "a".repeat(64),
          targetLocale: "en",
          ...values,
        })
        .returning();

      return row;
    };

    const rowOf = async (id: number) => {
      const [row] = await schema.db.select().from(jobs).where(eq(jobs.id, id));

      return row;
    };

    beforeAll(async () => {
      schema = await createPostgresTestSchema({ prefix: "vitnode_translate" });
      db = schema.db;
    });

    afterAll(async () => {
      await schema.drop();
    });

    it("lets exactly one of many concurrent workers claim a job", async () => {
      const job = await insertJob();
      const owners = Array.from({ length: 8 }, (_, i) => `worker-${i}`);

      const claims = await Promise.all(
        owners.map(async owner => await claimJob(db, job.id, owner)),
      );

      const winners = claims.filter(claim => claim !== null);
      expect(winners).toHaveLength(1);
      expect(await rowOf(job.id)).toMatchObject({
        attempts: 1,
        leaseOwner: winners[0]?.leaseOwner,
        status: "running",
      });
    });

    it("claims a job queued a moment ago even when the app clock runs behind the database", async () => {
      const job = await insertJob();
      vi.useFakeTimers({ now: Date.now() - 60_000, toFake: ["Date"] });
      try {
        expect(await claimJob(db, job.id, "worker-a")).toMatchObject({
          leaseOwner: "worker-a",
          status: "running",
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it.each<[string, Partial<typeof jobs.$inferInsert>]>([
      [
        "a job whose time has not come",
        { availableAt: new Date(Date.now() + 60_000) },
      ],
      [
        "a running job with a live lease",
        {
          leaseExpiresAt: new Date(Date.now() + 60_000),
          leaseOwner: "worker-a",
          status: "running",
        },
      ],
      ["a completed job", { status: "completed" }],
      ["a skipped job", { status: "skipped" }],
    ])("does not claim %s", async (_case, values) => {
      const job = await insertJob(values);

      expect(await claimJob(db, job.id, "worker-b")).toBeNull();
    });

    it("claims a job that waited for the budget once it is due", async () => {
      const job = await insertJob({ status: "waiting_budget" });

      expect(await claimJob(db, job.id, "worker-a")).toMatchObject({
        leaseOwner: "worker-a",
        status: "running",
      });
    });

    it("hands an expired lease to a new worker and ignores the old owner's finish", async () => {
      const job = await insertJob();
      const first = await claimJob(db, job.id, "worker-a");
      expect(first).not.toBeNull();
      await schema.db
        .update(jobs)
        .set({ leaseExpiresAt: new Date(Date.now() - 1000) })
        .where(eq(jobs.id, job.id));

      const second = await claimJob(db, job.id, "worker-b");
      expect(second).toMatchObject({ attempts: 2, leaseOwner: "worker-b" });

      // The first worker comes back late with its result.
      await finishJob(db, job, "worker-a", { kind: "completed", runId: 1 });
      expect(await rowOf(job.id)).toMatchObject({
        leaseOwner: "worker-b",
        runId: null,
        status: "running",
      });

      await finishJob(db, job, "worker-b", { kind: "completed", runId: 2 });
      expect(await rowOf(job.id)).toMatchObject({
        leaseExpiresAt: null,
        leaseOwner: null,
        runId: 2,
        status: "completed",
      });
    });

    it("gives a deferred job its attempt back and releases the lease", async () => {
      const job = await insertJob();
      await claimJob(db, job.id, "worker-a");
      const until = new Date(Date.now() + 3_600_000);

      await finishJob(db, job, "worker-a", {
        kind: "defer",
        status: "waiting_budget",
        until,
      });

      expect(await rowOf(job.id)).toMatchObject({
        attempts: 0,
        availableAt: until,
        leaseOwner: null,
        status: "waiting_budget",
      });
      expect(await claimJob(db, job.id, "worker-b")).toBeNull();
    });
  },
);
