// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";

import type { TestDatabaseHandle } from "@/tests/postgres";

import * as aiTables from "@/database/ai";
import {
  core_ai_budget_periods,
  core_ai_role_permissions,
  core_ai_role_policies,
  core_ai_runs,
  core_ai_user_overrides,
} from "@/database/ai";
import * as filesTables from "@/database/files";
import * as languagesTables from "@/database/languages";
import { core_languages } from "@/database/languages";
import * as rolesTables from "@/database/roles";
import { core_roles } from "@/database/roles";
import * as usersTables from "@/database/users";
import { core_users, core_users_secondary_roles } from "@/database/users";
import { createTestDatabase, describePostgres } from "@/tests/postgres";

import type { AiReservationRequest } from "./ledger";

import { formatDecimal, parseDecimal } from "./decimal";
import { PostgresAiLedger } from "./postgres-ledger";

describePostgres("PostgresAiLedger (real PostgreSQL)", () => {
  let database: TestDatabaseHandle;
  let ledger: PostgresAiLedger;
  let month = 0;

  const freshNow = () => {
    month += 1;

    return new Date(Date.UTC(2090, month, 15, 12));
  };

  const request = (
    overrides: Partial<AiReservationRequest> = {},
  ): AiReservationRequest => ({
    actionKey: "@acme/notes:summary.generate",
    actorType: "user",
    daily: null,
    globalMonthlyUsd: null,
    idempotencyKey: null,
    leaseMs: 60_000,
    model: {
      modelId: "default",
      provider: "mock",
      providerModelId: "mock-1",
    },
    now: new Date(),
    pluginId: "@acme/notes",
    promptVersion: 1,
    resource: undefined,
    sourceFingerprint: null,
    systemConcurrency: 100,
    systemMonthlyUsd: null,
    timeZone: "UTC",
    usd: parseDecimal("0.03"),
    userConcurrency: 100,
    userId: 1,
    userMonthlyPoints: null,
    userRequestsPerMinute: 1_000,
    ...overrides,
  });

  const settle = async (runId: number, delivered = true) =>
    await ledger.settle(runId, {
      delivered,
      errorCode: null,
      finishedAt: new Date(),
      status: delivered ? "succeeded" : "failed",
    });

  const finishCall = async (runId: number, costUsd: null | string) => {
    const callId = await ledger.beginCall({
      attempt: 1,
      modelId: "default",
      provider: "mock",
      providerModelId: "mock-1",
      runId,
      startedAt: new Date(),
    });
    await ledger.finishCall(callId, {
      cost:
        costUsd === null
          ? { amountUsd: null, reason: "no pricing", source: "unknown" }
          : { amountUsd: costUsd, pricingVersion: "test", source: "pricing" },
      errorCode: null,
      finishedAt: new Date(),
      images: 0,
      pricingSnapshot: null,
      providerModelId: "mock-1",
      providerRequestId: "req",
      status: "succeeded",
      usage: {
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        inputTokens: 10,
        outputTokens: 5,
        reasoningTokens: null,
      },
    });
  };

  const budgetRow = async (scopeKey: string, now: Date) => {
    const rows = await database.db
      .select()
      .from(core_ai_budget_periods)
      .where(eq(core_ai_budget_periods.scopeKey, scopeKey));

    return rows.find(
      row =>
        row.periodStart.getTime() <= now.getTime() &&
        row.periodEnd.getTime() > now.getTime(),
    );
  };

  beforeAll(async () => {
    database = await createTestDatabase({
      ...aiTables,
      ...filesTables,
      ...languagesTables,
      ...rolesTables,
      ...usersTables,
    });
    ledger = new PostgresAiLedger(database.db);
    await database.db.insert(core_languages).values({
      code: "en",
      default: true,
      name: "English",
    });
    await database.db.insert(core_roles).values([
      { id: 1, updatedAt: new Date() },
      { id: 2, updatedAt: new Date() },
      { id: 3, root: true, updatedAt: new Date() },
    ]);
    await database.db.insert(core_users).values(
      [1, 2, 3, 4, 5].map(id => ({
        avatarColor: "000000",
        email: `user${id}@test.test`,
        id,
        ipAddress: "127.0.0.1",
        name: `user${id}`,
        nameCode: `user${id}`,
        roleId: id === 5 ? 3 : 1,
      })),
    );
  }, 60_000);

  afterAll(async () => {
    await database?.drop();
  });

  it("lets concurrent runs take only the global budget that exists", async () => {
    const now = freshNow();
    const attempts = await Promise.all(
      Array.from(
        { length: 12 },
        async () =>
          await ledger.reserve(
            request({ globalMonthlyUsd: parseDecimal("0.1"), now }),
          ),
      ),
    );

    expect(attempts.filter(result => result.ok)).toHaveLength(3);
    expect(
      attempts
        .filter(result => !result.ok)
        .map(result => !result.ok && result.code),
    ).toEqual(Array(9).fill("AI_BUDGET_EXHAUSTED"));
    const global = await budgetRow("global", now);
    expect(global?.reservedAmount).toBe("0.090000000000");
  });

  it("lets concurrent runs of one user take only the points they have", async () => {
    const now = freshNow();
    const attempts = await Promise.all(
      Array.from(
        { length: 8 },
        async () =>
          await ledger.reserve(
            request({
              now,
              userId: 2,
              userMonthlyPoints: parseDecimal("50"),
            }),
          ),
      ),
    );

    expect(attempts.filter(result => result.ok)).toHaveLength(1);
    expect(
      attempts.find(
        result => !result.ok && result.code === "AI_USER_LIMIT_REACHED",
      ),
    ).toBeDefined();
  });

  it("enforces per-user concurrency under a race", async () => {
    const now = freshNow();
    const attempts = await Promise.all(
      Array.from(
        { length: 6 },
        async () =>
          await ledger.reserve(request({ now, userConcurrency: 2, userId: 3 })),
      ),
    );

    expect(attempts.filter(result => result.ok)).toHaveLength(2);
  });

  it("settles a run exactly once, however many settle at the same time", async () => {
    const now = freshNow();
    const reserved = await ledger.reserve(request({ now, userId: 4 }));
    if (!reserved.ok) throw new Error(reserved.code);
    await finishCall(reserved.runId, "0.012");

    const results = await Promise.all(
      Array.from({ length: 5 }, async () => await settle(reserved.runId)),
    );

    expect(results.filter(result => result.applied)).toHaveLength(1);
    const user = await budgetRow("user:4", now);
    expect(user?.spentAmount).toBe("12.000000000000");
    expect(user?.reservedAmount).toBe("0.000000000000");
    const global = await budgetRow("global", now);
    expect(global?.spentAmount).toBe("0.012000000000");
  });

  it("charges the site the whole hold for an unknown cost, and the user nothing for a failure", async () => {
    const now = freshNow();
    const reserved = await ledger.reserve(request({ now, userId: 4 }));
    if (!reserved.ok) throw new Error(reserved.code);
    await finishCall(reserved.runId, null);

    const result = await settle(reserved.runId, false);

    expect(result).toMatchObject({ applied: true, costKnown: false });
    expect(formatDecimal(result.chargedUsd)).toBe("0.03");
    const global = await budgetRow("global", now);
    expect(global).toMatchObject({
      spentAmount: "0.030000000000",
      unknownCount: 1,
    });
    const user = await budgetRow("user:4", now);
    expect(user?.spentAmount).toBe("0.000000000000");
  });

  it("runs a duplicated idempotency key once, even when both race", async () => {
    const now = freshNow();
    const results = await Promise.all(
      Array.from(
        { length: 4 },
        async () =>
          await ledger.reserve(
            request({ idempotencyKey: "same", now, userId: 4 }),
          ),
      ),
    );

    expect(results.filter(result => result.ok)).toHaveLength(1);
    expect(
      results.filter(
        result => !result.ok && result.code === "AI_DUPLICATE_REQUEST",
      ),
    ).toHaveLength(3);
  });

  it("never deadlocks when users and the system reserve at once", async () => {
    const now = freshNow();
    const results = await Promise.all(
      Array.from(
        { length: 30 },
        async (_, index) =>
          await ledger.reserve(
            request({
              actorType: index % 3 === 0 ? "system" : "user",
              daily:
                index % 3 === 0
                  ? null
                  : { limit: 100, permissionKey: "@acme/notes:summary" },
              now,
              userId: index % 3 === 0 ? null : (index % 2) + 1,
            }),
          ),
      ),
    );

    expect(results.every(result => result.ok)).toBe(true);
  });

  it("resolves policies from real role tables: largest allowance, override wins", async () => {
    await database.db
      .insert(core_users_secondary_roles)
      .values({ roleId: 2, userId: 1 });
    await database.db.insert(core_ai_role_policies).values([
      { monthlyPoints: "100", roleId: 1 },
      { monthlyPoints: "400", roleId: 2 },
    ]);
    await database.db.insert(core_ai_role_permissions).values([
      { dailyLimit: 5, permission: "@acme/notes:summary", roleId: 1 },
      { dailyLimit: 9, permission: "@acme/notes:summary", roleId: 2 },
    ]);

    const policy = await ledger.resolveUserPolicy({
      defaultGranted: false,
      permissionKey: "@acme/notes:summary",
      userId: 1,
    });

    expect(policy).toEqual({
      dailyLimit: 9,
      granted: true,
      monthlyPoints: parseDecimal("400"),
    });

    await database.db
      .insert(core_ai_user_overrides)
      .values({ monthlyPoints: "7", userId: 1 });
    const overridden = await ledger.resolveUserPolicy({
      defaultGranted: false,
      permissionKey: "@acme/notes:summary",
      userId: 1,
    });
    expect(overridden.monthlyPoints).toBe(parseDecimal("7"));

    const root = await ledger.resolveUserPolicy({
      defaultGranted: false,
      permissionKey: "@acme/notes:other",
      userId: 5,
    });
    expect(root).toMatchObject({ granted: true, monthlyPoints: null });
  });

  it("keeps consumed usage when a user's roles change", async () => {
    const now = freshNow();
    const reserved = await ledger.reserve(
      request({ now, userId: 3, userMonthlyPoints: parseDecimal("100") }),
    );
    if (!reserved.ok) throw new Error(reserved.code);
    await finishCall(reserved.runId, "0.05");
    await settle(reserved.runId);

    const next = await ledger.reserve(
      request({
        now,
        userId: 3,
        usd: parseDecimal("0.02"),
        userMonthlyPoints: parseDecimal("60"),
      }),
    );

    expect(next).toMatchObject({ code: "AI_USER_LIMIT_REACHED", ok: false });
    const [run] = await database.db
      .select({ chargedPoints: core_ai_runs.chargedPoints })
      .from(core_ai_runs)
      .where(eq(core_ai_runs.id, reserved.runId));
    expect(run.chargedPoints).toBe("50.000000000000");
  });
});
