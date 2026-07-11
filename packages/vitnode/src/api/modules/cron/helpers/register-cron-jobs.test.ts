import type { drizzle } from "drizzle-orm/postgres-js";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CronJobConfig } from "@/api/lib/cron";

import { registerCronJobs } from "./register-cron-jobs";

interface DbRow {
  createdAt: Date;
  description: null | string;
  id: number;
  lastRun: Date | null;
  module: string;
  name: string;
  nextRun: Date | null;
  pluginId: string;
  schedule: string;
}

const makeJob = (overrides: Partial<CronJobConfig> = {}): CronJobConfig => ({
  pluginId: "@vitnode/core",
  module: "queue",
  name: "process-queue",
  schedule: "* * * * *",
  description: "Process pending database queue tasks",
  handler: vi.fn(),
  ...overrides,
});

const makeRow = (overrides: Partial<DbRow> = {}): DbRow => ({
  id: 1,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  description: "Process pending database queue tasks",
  lastRun: null,
  nextRun: null,
  module: "queue",
  name: "process-queue",
  pluginId: "@vitnode/core",
  schedule: "* * * * *",
  ...overrides,
});

const createMockDb = (existing: DbRow[]) => {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn(() => ({ where: updateWhere }));

  const db = {
    select: vi.fn(() => ({ from: vi.fn().mockResolvedValue(existing) })),
    insert: vi.fn(() => ({ values: insertValues })),
    delete: vi.fn(() => ({ where: deleteWhere })),
    update: vi.fn(() => ({ set: updateSet })),
  } as unknown as ReturnType<typeof drizzle>;

  return { db, insertValues, deleteWhere, updateSet, updateWhere };
};

describe("registerCronJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts jobs that are not yet in the database", async () => {
    const { db, insertValues, deleteWhere, updateSet } = createMockDb([]);

    await registerCronJobs(db, [makeJob()]);

    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "process-queue",
        pluginId: "@vitnode/core",
        module: "queue",
        schedule: "* * * * *",
        lastRun: null,
        nextRun: null,
      }),
    ]);
    expect(deleteWhere).not.toHaveBeenCalled();
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("updates a job whose schedule changed", async () => {
    const { db, insertValues, updateSet } = createMockDb([
      makeRow({ schedule: "0 * * * *" }),
    ]);

    await registerCronJobs(db, [makeJob({ schedule: "* * * * *" })]);

    expect(insertValues).not.toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalledTimes(1);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ schedule: "* * * * *" }),
    );
  });

  it("deletes jobs that are no longer registered", async () => {
    const { db, insertValues, deleteWhere, updateSet } = createMockDb([
      makeRow(),
      makeRow({ id: 2, module: "legacy", name: "removed-cron" }),
    ]);

    await registerCronJobs(db, [makeJob()]);

    expect(deleteWhere).toHaveBeenCalledTimes(1);
    expect(insertValues).not.toHaveBeenCalled();
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("does not execute cron handlers", async () => {
    const handler = vi.fn();
    const { db } = createMockDb([]);

    await registerCronJobs(db, [makeJob({ handler })]);

    expect(handler).not.toHaveBeenCalled();
  });

  it("leaves unchanged jobs untouched", async () => {
    const { db, insertValues, deleteWhere, updateSet } = createMockDb([
      makeRow(),
    ]);

    await registerCronJobs(db, [makeJob()]);

    expect(insertValues).not.toHaveBeenCalled();
    expect(deleteWhere).not.toHaveBeenCalled();
    expect(updateSet).not.toHaveBeenCalled();
  });
});
