// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { MockLanguageModelV4 } from "ai/test";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { z } from "zod";

import type { AIModelDefinition } from "@/api/models/ai";
import type { TestDatabaseHandle } from "@/tests/postgres";

import { defineAiAction } from "@/api/lib/ai/action";
import { parseDecimal } from "@/api/lib/ai/decimal";
import {
  applyAiCostAdjustment,
  expireAiLeases,
} from "@/api/lib/ai/maintenance";
import { PostgresAiLedger } from "@/api/lib/ai/postgres-ledger";
import { collectAiActions } from "@/api/lib/ai/registry";
import { AIModel } from "@/api/models/ai";
import * as adminsTables from "@/database/admins";
import * as aiTables from "@/database/ai";
import {
  core_ai_budget_periods,
  core_ai_calls,
  core_ai_runs,
} from "@/database/ai";
import * as filesTables from "@/database/files";
import * as languagesTables from "@/database/languages";
import { core_languages, core_languages_words } from "@/database/languages";
import * as moderatorsTables from "@/database/moderators";
import * as rolesTables from "@/database/roles";
import { core_roles } from "@/database/roles";
import * as sessionsTables from "@/database/sessions";
import * as usersTables from "@/database/users";
import { core_users } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createTestDatabase, describePostgres } from "@/tests/postgres";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { aiAdminModule } from "../admin/ai/ai.admin.module";
import { aiModule } from "./ai.module";

const ADMIN_ID = 1;
const ALICE = 2;
const BOB = 3;

const summarize = defineAiAction({
  authorize: () => true,
  buildPrompt: input => ({ prompt: input.text }),
  defaults: {
    maxInputCharacters: 1_000,
    maxOutputTokens: 50,
    timeoutMs: 10_000,
  },
  description: "Test action.",
  id: "summary.generate",
  title: "Test action",
  inputSchema: z.object({ text: z.string() }),
  output: "text",
  outputSchema: z.string().min(1),
  parseText: text => text.trim(),
  permission: { defaultGranted: true, key: "summary" },
  promptVersion: 1,
  requiredCapabilities: ["text"],
});

const aiActions = collectAiActions([
  { aiActions: [summarize], pluginId: "@acme/notes" },
]);

const answering = () =>
  new MockLanguageModelV4({
    doGenerate: async () =>
      Promise.resolve({
        content: [{ text: "Short.", type: "text" }],
        finishReason: { raw: "stop", unified: "stop" },
        usage: {
          inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 10, total: 10 },
          outputTokens: { reasoning: 0, text: 5, total: 5 },
        },
        warnings: [],
      }),
  });

describePostgres("AI routes (real PostgreSQL)", () => {
  let database: TestDatabaseHandle;
  const cache = createTestCache();
  let models: AIModelDefinition[];

  const app = () => {
    const hono = new OpenAPIHono();
    hono.use("*", async (c, next) => {
      const userId = Number(c.req.header("x-user") ?? 0) || null;
      const isAdmin = c.req.path.includes("/admin/");
      c.set("db", database.db);
      c.set("cache", cache);
      c.set("core" as never, { ai: { models }, aiActions } as never);
      const identity = userId
        ? { id: userId, roleId: userId === ADMIN_ID ? 1 : 2 }
        : null;
      c.set("user", (identity && !isAdmin ? identity : null) as never);
      c.set(
        "admin",
        (identity && isAdmin ? { user: identity } : null) as never,
      );
      c.set("ai", new AIModel(c as unknown as Context));
      await next();
    });
    hono.route("/ai", aiModule.hono);
    hono.route("/admin/ai", aiAdminModule.hono);

    return hono;
  };

  const request = async (
    path: string,
    {
      body,
      method = "GET",
      user,
    }: { body?: unknown; method?: string; user: number },
  ) =>
    await app().request(path, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { "Content-Type": "application/json", "x-user": String(user) },
      method,
    });

  const runFor = async (user: number) =>
    await request("/ai/run", {
      body: { action: "@acme/notes:summary.generate", input: { text: "x" } },
      method: "POST",
      user,
    });

  beforeAll(async () => {
    database = await createTestDatabase({
      ...adminsTables,
      ...moderatorsTables,
      ...sessionsTables,
      ...aiTables,
      ...filesTables,
      ...languagesTables,
      ...rolesTables,
      ...usersTables,
    });
    models = [
      {
        id: "default",
        model: answering(),
        name: "Test",
        pricing: {
          rates: { inputPerMillion: "1000", outputPerMillion: "2000" },
        },
      },
    ];
    await database.db
      .insert(core_languages)
      .values({ code: "en", default: true, name: "English" });
    await database.db.insert(core_roles).values([
      { id: 1, root: true, updatedAt: new Date() },
      { id: 2, updatedAt: new Date() },
    ]);
    await database.db.insert(core_languages_words).values({
      itemId: 2,
      languageCode: "en",
      pluginCode: "core",
      tableName: "core_roles",
      value: "Member",
      variable: "name",
    });
    await database.db.insert(core_users).values(
      [ADMIN_ID, ALICE, BOB].map(id => ({
        avatarColor: "000000",
        email: `u${id}@test.test`,
        id,
        ipAddress: "127.0.0.1",
        name: `u${id}`,
        nameCode: `u${id}`,
        roleId: id === ADMIN_ID ? 1 : 2,
      })),
    );
    await database.db.insert(aiTables.core_ai_role_policies).values({
      monthlyPoints: "1000",
      roleId: 2,
    });
    await grantStaffPermissions(cache, {
      permissions: [
        { module: "ai", permission: "can_view", plugin: "@vitnode/core" },
      ],
      userId: ADMIN_ID,
    });
  }, 60_000);

  afterAll(async () => {
    await database?.drop();
  });

  it("runs an action for the signed-in user and returns safe usage", async () => {
    const response = await runFor(ALICE);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      output: "Short.",
      usage: { chargedPoints: "20", costKnown: true, modelId: "default" },
    });
  });

  it("refuses anonymous runs", async () => {
    const response = await runFor(0);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "AI_UNAUTHORIZED" });
  });

  it("shows each user only their own history and usage", async () => {
    await runFor(BOB);
    await runFor(BOB);

    const alice = (await (
      await request("/ai/history", { user: ALICE })
    ).json()) as {
      items: { id: number }[];
    };
    const bob = (await (
      await request("/ai/history", { user: BOB })
    ).json()) as {
      items: { id: number }[];
    };
    const aliceRunIds = (
      await database.db
        .select({ id: core_ai_runs.id })
        .from(core_ai_runs)
        .where(eq(core_ai_runs.userId, ALICE))
    ).map(row => row.id);

    expect(alice.items.map(item => item.id).sort((a, b) => a - b)).toEqual(
      aliceRunIds.sort((a, b) => a - b),
    );
    expect(bob.items).toHaveLength(2);
    // A cursor from someone else's history widens nothing.
    const sneaky = (await (
      await request(`/ai/history?before=2147483647`, {
        user: ALICE,
      })
    ).json()) as { items: { id: number }[] };
    expect(sneaky.items.map(item => item.id).sort((a, b) => a - b)).toEqual(
      aliceRunIds.sort((a, b) => a - b),
    );

    const usage = (await (
      await request("/ai/usage", { user: BOB })
    ).json()) as {
      points: { total: string; used: string };
    };
    expect(usage.points).toMatchObject({ total: "1000", used: "40" });
  });

  it("only lets a user give feedback on their own run", async () => {
    const [bobsRun] = await database.db
      .select({ id: core_ai_runs.id })
      .from(core_ai_runs)
      .where(eq(core_ai_runs.userId, BOB))
      .limit(1);

    const foreign = await request(`/ai/runs/${bobsRun.id}/feedback`, {
      body: { accepted: true },
      method: "POST",
      user: ALICE,
    });
    const own = await request(`/ai/runs/${bobsRun.id}/feedback`, {
      body: { accepted: true },
      method: "POST",
      user: BOB,
    });

    expect(foreign.status).toBe(404);
    expect(own.status).toBe(200);
  });

  it("keeps the AdminCP behind staff permissions", async () => {
    const withView = await request("/admin/ai/history", { user: ADMIN_ID });
    const without = await request("/admin/ai/history", { user: ALICE });
    const manage = await request("/admin/ai/settings", {
      body: {
        altBatchSize: 10,
        altEnabled: false,
        altLanguages: null,
        defaultMonthlyPoints: "0",
        enabled: true,
        historyRetentionDays: 365,
        monthlyBudgetUsd: null,
        systemConcurrency: 2,
        systemMonthlyBudgetUsd: null,
        userConcurrency: 2,
        userRequestsPerMinute: 10,
      },
      method: "PUT",
      user: ADMIN_ID,
    });

    expect(withView.status).toBe(200);
    expect(without.status).toBe(403);
    // can_view does not include can_manage.
    expect(manage.status).toBe(403);
  });

  it("refuses to switch on automatic ALT without a site budget", async () => {
    await grantStaffPermissions(cache, {
      permissions: [
        { module: "ai", permission: "can_view", plugin: "@vitnode/core" },
        { module: "ai", permission: "can_manage", plugin: "@vitnode/core" },
      ],
      userId: ADMIN_ID,
    });
    const settings = {
      altBatchSize: 10,
      altEnabled: true,
      altLanguages: null,
      defaultMonthlyPoints: "0",
      enabled: true,
      historyRetentionDays: 365,
      monthlyBudgetUsd: null,
      systemConcurrency: 2,
      systemMonthlyBudgetUsd: null,
      userConcurrency: 2,
      userRequestsPerMinute: 10,
    };

    const refused = await request("/admin/ai/settings", {
      body: settings,
      method: "PUT",
      user: ADMIN_ID,
    });
    const saved = await request("/admin/ai/settings", {
      body: { ...settings, monthlyBudgetUsd: "25" },
      method: "PUT",
      user: ADMIN_ID,
    });

    expect(refused.status).toBe(400);
    expect(saved.status).toBe(200);
    expect(
      (await (
        await request("/admin/ai/settings", { user: ADMIN_ID })
      ).json()) as object,
    ).toMatchObject({ altEnabled: true, monthlyBudgetUsd: "25" });
  });

  it("reports known cost, coverage and averages without counting unknown as zero", async () => {
    // One more run, on a model with no pricing: its cost is unknown. That is
    // only allowed with no cap in the way, so the site budget goes too.
    models = [{ ...models[0], pricing: undefined }];
    await database.db
      .update(aiTables.core_ai_settings)
      .set({ altEnabled: false, monthlyBudgetUsd: null });
    await database.db
      .update(aiTables.core_ai_role_policies)
      .set({ unlimited: true })
      .where(eq(aiTables.core_ai_role_policies.roleId, 2));
    await runFor(ALICE);

    const overview = (await (
      await request("/admin/ai/overview", { user: ADMIN_ID })
    ).json()) as {
      averageOperationCostUsd: string;
      costSources: { unknown: number };
      operations: number;
      pricingCoverage: number;
    };

    expect(overview.operations).toBe(4);
    expect(overview.costSources.unknown).toBe(1);
    expect(overview.pricingCoverage).toBe(0.75);
    // 3 known runs at $0.02 each: the unknown one is left out, not averaged as $0.
    expect(overview.averageOperationCostUsd).toBe("0.02");
  });

  it("reads a role's AI access for the role form, with action titles", async () => {
    const existing = await request("/admin/ai/access/roles?roleId=1", {
      user: ADMIN_ID,
    });
    const creating = await request("/admin/ai/access/roles", {
      user: ADMIN_ID,
    });
    const notStaff = await request("/admin/ai/access/roles?roleId=1", {
      user: ALICE,
    });

    expect(existing.status).toBe(200);
    expect(await existing.json()).toEqual({
      permissions: [
        {
          actions: [
            {
              icon: null,
              key: "@acme/notes:summary.generate",
              title: "Test action",
            },
          ],
          defaultGranted: true,
          key: "@acme/notes:summary",
        },
      ],
      role: { grants: [], monthlyPoints: null, root: true, unlimited: false },
    });
    expect(await creating.json()).toMatchObject({ role: null });
    expect(notStaff.status).toBe(403);
  });

  it("saves a member's AI exception and reads it back for their page", async () => {
    await grantStaffPermissions(cache, {
      permissions: [
        { module: "ai", permission: "can_view", plugin: "@vitnode/core" },
        { module: "ai", permission: "can_manage", plugin: "@vitnode/core" },
      ],
      userId: ADMIN_ID,
    });
    const path = `/admin/ai/access/users/${BOB}`;
    const before = await request(path, { user: ADMIN_ID });
    const denied = await request("/admin/ai/access/users", {
      body: {
        blocked: true,
        monthlyPoints: null,
        unlimited: false,
        userId: BOB,
      },
      method: "PUT",
      user: ALICE,
    });
    const saved = await request("/admin/ai/access/users", {
      body: {
        blocked: true,
        monthlyPoints: null,
        unlimited: false,
        userId: BOB,
      },
      method: "PUT",
      user: ADMIN_ID,
    });
    const after = await request(path, { user: ADMIN_ID });

    expect(await before.json()).toEqual({ override: null });
    expect(denied.status).toBe(403);
    expect(saved.status).toBe(200);
    expect(await after.json()).toEqual({
      override: { blocked: true, monthlyPoints: null, unlimited: false },
    });
  });
});

describePostgres("AI maintenance (real PostgreSQL)", () => {
  let database: TestDatabaseHandle;
  let ledger: PostgresAiLedger;

  const reserve = async (userId: null | number, now = new Date()) => {
    const result = await ledger.reserve({
      actionKey: "@acme/notes:summary.generate",
      actorType: userId === null ? "system" : "user",
      daily: null,
      globalMonthlyUsd: null,
      idempotencyKey: null,
      leaseMs: 1_000,
      model: {
        modelId: "default",
        provider: "gateway",
        providerModelId: "x/y",
      },
      now,
      pluginId: "@acme/notes",
      promptVersion: 1,
      resource: undefined,
      sourceFingerprint: null,
      systemConcurrency: 10,
      systemMonthlyUsd: null,
      timeZone: "UTC",
      usd: parseDecimal("0.05"),
      userConcurrency: 10,
      userId,
      userMonthlyPoints: null,
      userRequestsPerMinute: 100,
    });
    if (!result.ok) throw new Error(result.code);

    return result.runId;
  };

  const spent = async (scopeKey: string) => {
    const [row] = await database.db
      .select({ spent: core_ai_budget_periods.spentAmount })
      .from(core_ai_budget_periods)
      .where(eq(core_ai_budget_periods.scopeKey, scopeKey));

    return row?.spent;
  };

  beforeAll(async () => {
    database = await createTestDatabase({
      ...adminsTables,
      ...moderatorsTables,
      ...sessionsTables,
      ...aiTables,
      ...filesTables,
      ...languagesTables,
      ...rolesTables,
      ...usersTables,
    });
    ledger = new PostgresAiLedger(database.db);
    await database.db
      .insert(core_languages)
      .values({ code: "en", default: true, name: "English" });
    await database.db
      .insert(core_roles)
      .values({ id: 1, updatedAt: new Date() });
    await database.db.insert(core_users).values({
      avatarColor: "000000",
      email: "u@test.test",
      id: 1,
      ipAddress: "127.0.0.1",
      name: "u",
      nameCode: "u",
      roleId: 1,
    });
  }, 60_000);

  afterAll(async () => {
    await database?.drop();
  });

  it("settles a run whose process died as uncertain, charging the site but not the user", async () => {
    const runId = await reserve(1, new Date(Date.now() - 10_000));
    await ledger.markRunning(runId, new Date(Date.now() - 5_000));
    // The provider call started and never reported back.
    await ledger.beginCall({
      attempt: 1,
      modelId: "default",
      provider: "gateway",
      providerModelId: "x/y",
      runId,
      startedAt: new Date(Date.now() - 9_000),
    });

    expect(await expireAiLeases(database.db)).toBe(1);
    const [run] = await database.db
      .select()
      .from(core_ai_runs)
      .where(eq(core_ai_runs.id, runId));
    expect(run).toMatchObject({
      chargedPoints: "0.000000000000",
      chargedUsd: "0.050000000000",
      settlement: "settled",
      status: "uncertain",
    });
    expect(await expireAiLeases(database.db)).toBe(0);
  });

  it("replaces an estimate with the billed cost once, moving budgets by the difference", async () => {
    const runId = await reserve(null);
    const callId = await ledger.beginCall({
      attempt: 1,
      modelId: "default",
      provider: "gateway",
      providerModelId: "x/y",
      runId,
      startedAt: new Date(),
    });
    await ledger.finishCall(callId, {
      cost: {
        amountUsd: "0.01",
        pricingVersion: "config:1",
        source: "pricing",
      },
      errorCode: null,
      finishedAt: new Date(),
      images: 0,
      pricingSnapshot: null,
      providerModelId: "x/y",
      providerRequestId: "gen_1",
      status: "succeeded",
      usage: {
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        inputTokens: 10,
        outputTokens: 5,
        reasoningTokens: null,
      },
    });
    await ledger.settle(runId, {
      delivered: true,
      errorCode: null,
      finishedAt: new Date(),
      status: "succeeded",
    });
    const before = parseDecimal((await spent("system")) ?? "0");

    const first = await applyAiCostAdjustment(database.db, {
      billedUsd: parseDecimal("0.012"),
      callId,
      reason: "gateway",
    });
    const second = await applyAiCostAdjustment(database.db, {
      billedUsd: parseDecimal("0.012"),
      callId,
      reason: "gateway",
    });

    expect([first, second]).toEqual([true, false]);
    expect(parseDecimal((await spent("system")) ?? "0") - before).toBe(
      parseDecimal("0.002"),
    );
    const [call] = await database.db
      .select({
        costSource: core_ai_calls.costSource,
        costUsd: core_ai_calls.costUsd,
      })
      .from(core_ai_calls)
      .where(eq(core_ai_calls.id, callId));
    expect(call).toEqual({ costSource: "provider", costUsd: "0.012000000000" });
  });
});
