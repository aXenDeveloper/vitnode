// @vitest-environment node
import type { Context } from "hono";

import { MockLanguageModelV4 } from "ai/test";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { AIModelDefinition } from "@/api/models/ai";
import type { TestDatabaseHandle } from "@/tests/postgres";

import { QueueDeferError } from "@/api/lib/queue";
import { AIModel } from "@/api/models/ai";
import { QueueModel } from "@/api/models/queue";
import { processQueueTasks } from "@/api/modules/queue/helpers/process-queue-tasks";
import * as aiTables from "@/database/ai";
import { core_ai_runs, core_ai_settings } from "@/database/ai";
import * as filesTables from "@/database/files";
import {
  core_files,
  core_files_alt,
  core_files_alt_analysis,
  core_files_alt_state,
} from "@/database/files";
import * as languagesTables from "@/database/languages";
import { core_languages } from "@/database/languages";
import * as queueTables from "@/database/queue";
import { core_queue } from "@/database/queue";
import * as rolesTables from "@/database/roles";
import * as usersTables from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createTestDatabase, describePostgres } from "@/tests/postgres";

import {
  ALT_QUEUE,
  ALT_TASK_NAME,
  detectMissingAlt,
  enqueueAltGeneration,
  processAltForFile,
} from "./alt";
import { altGenerateAiAction, altTranslateAiAction } from "./alt-actions";
import { collectAiActions } from "./registry";

const generatedText = (text: string) => ({
  content: [{ text, type: "text" as const }],
  finishReason: { raw: "stop", unified: "stop" as const },
  usage: {
    inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 100, total: 100 },
    outputTokens: { reasoning: 0, text: 10, total: 10 },
  },
  warnings: [],
});

/** Answers a vision prompt with a description, anything else with a translation. */
const createModel = () => {
  const calls = { translate: [] as string[], vision: 0 };
  const model = new MockLanguageModelV4({
    doGenerate: async options => {
      const prompt = JSON.stringify(options.prompt);
      if (prompt.includes('"type":"file"')) {
        calls.vision += 1;

        return Promise.resolve(generatedText("A red bicycle."));
      }
      const language = /into ([A-Za-z]+)/.exec(prompt)?.[1] ?? "?";
      calls.translate.push(language);

      return Promise.resolve(generatedText(`[${language}] A red bicycle.`));
    },
  });

  return { calls, model };
};

describePostgres("automatic ALT (real PostgreSQL)", () => {
  let database: TestDatabaseHandle;
  let calls: ReturnType<typeof createModel>["calls"];
  let models: AIModelDefinition[];
  let bytes = Buffer.from("first version of the image");
  const cache = createTestCache();
  const aiActions = collectAiActions([
    {
      aiActions: [altGenerateAiAction, altTranslateAiAction],
      pluginId: "@vitnode/core",
    },
  ]);

  const context = (): Context<EnvVitNode> => {
    const store = new Map<string, unknown>();
    const c = {
      get: (key: string) => store.get(key),
      set: (key: string, value: unknown) => store.set(key, value),
    } as unknown as Context<EnvVitNode>;
    store.set("db", database.db);
    store.set("cache", cache);
    store.set("core", {
      ai: { models },
      aiActions,
      queue: [
        {
          handler: async (
            ctx: Context<EnvVitNode>,
            payload: { fileId: number },
          ) => await processAltForFile(ctx, payload.fileId),
          leaseSeconds: 900,
          maxAttempts: 3,
          module: "ai",
          name: ALT_TASK_NAME,
          pluginId: "@vitnode/core",
        },
      ],
    });
    store.set("events", { emit: async () => await Promise.resolve() });
    store.set("log", { error: async () => {}, warn: async () => {} });
    store.set("queue", new QueueModel(c));
    store.set("storage", {
      readBytes: async () => await Promise.resolve(bytes),
    });
    store.set("user", null);
    store.set("admin", null);
    store.set("ai", new AIModel(c));

    return c;
  };

  const insertFile = async (
    overrides: Partial<typeof core_files.$inferInsert> = {},
  ) => {
    const [file] = await database.db
      .insert(core_files)
      .values({
        folder: "test",
        key: `key-${Math.random()}`,
        mimeType: "image/png",
        name: "bike.png",
        size: 10,
        ...overrides,
      })
      .returning({ id: core_files.id });

    return file.id;
  };

  const altsOf = async (fileId: number) =>
    Object.fromEntries(
      (
        await database.db
          .select()
          .from(core_files_alt)
          .where(eq(core_files_alt.fileId, fileId))
      ).map(row => [row.languageCode, { origin: row.origin, text: row.text }]),
    );

  beforeAll(async () => {
    database = await createTestDatabase({
      ...aiTables,
      ...filesTables,
      ...languagesTables,
      ...queueTables,
      ...rolesTables,
      ...usersTables,
    });
    await database.db.insert(core_languages).values([
      { code: "en", default: true, name: "English" },
      { code: "pl", name: "Polski" },
    ]);
  }, 60_000);

  beforeEach(async () => {
    const created = createModel();
    calls = created.calls;
    models = [
      {
        capabilities: ["text", "image-input"],
        id: "vision",
        model: created.model,
        name: "Vision",
        pricing: { rates: { inputPerMillion: "1", outputPerMillion: "2" } },
      },
    ];
    bytes = Buffer.from("first version of the image");
    await database.db
      .insert(core_ai_settings)
      .values({ altEnabled: true, id: 1, monthlyBudgetUsd: "100" })
      .onConflictDoUpdate({
        set: {
          altEnabled: true,
          monthlyBudgetUsd: "100",
          systemConcurrency: 2,
        },
        target: core_ai_settings.id,
      });
  });

  afterAll(async () => {
    await database?.drop();
  });

  it("describes an image once and translates it into every other language", async () => {
    const fileId = await insertFile();

    const result = await processAltForFile(context(), fileId);

    expect(result.written.sort()).toEqual(["en", "pl"]);
    expect(calls).toEqual({ translate: ["Polish"], vision: 1 });
    expect(await altsOf(fileId)).toEqual({
      en: { origin: "ai", text: "A red bicycle." },
      pl: { origin: "ai", text: "[Polish] A red bicycle." },
    });
    const runs = await database.db
      .select({
        actorType: core_ai_runs.actorType,
        userId: core_ai_runs.userId,
      })
      .from(core_ai_runs)
      .where(eq(core_ai_runs.resourceId, String(fileId)));
    expect(runs).toEqual([
      { actorType: "system", userId: null },
      { actorType: "system", userId: null },
    ]);
  });

  it("never overwrites a person's text, even an intentionally empty one", async () => {
    const fileId = await insertFile();
    await database.db.insert(core_files_alt).values({
      fileId,
      languageCode: "pl",
      origin: "human",
      text: "",
    });

    await processAltForFile(context(), fileId);

    expect(await altsOf(fileId)).toEqual({
      en: { origin: "ai", text: "A red bicycle." },
      pl: { origin: "human", text: "" },
    });
    expect(calls.translate).toEqual([]);
  });

  it("fills only the new language when one is added, reusing the analysis", async () => {
    const fileId = await insertFile();
    await processAltForFile(context(), fileId);
    await database.db
      .insert(core_languages)
      .values({ code: "de", name: "Deutsch" });
    const before = { ...calls, translate: [...calls.translate] };

    await processAltForFile(context(), fileId);

    expect(calls.vision).toBe(before.vision);
    expect(calls.translate).toEqual([...before.translate, "German"]);
    expect((await altsOf(fileId)).de).toEqual({
      origin: "ai",
      text: "[German] A red bicycle.",
    });
    await database.db
      .delete(core_languages)
      .where(eq(core_languages.code, "de"));
  });

  it("re-describes a changed file, keeping what people wrote", async () => {
    const fileId = await insertFile();
    await processAltForFile(context(), fileId);
    await database.db
      .update(core_files_alt)
      .set({ origin: "human", text: "Mój rower" })
      .where(
        and(
          eq(core_files_alt.fileId, fileId),
          eq(core_files_alt.languageCode, "pl"),
        ),
      );

    // A replaced file gets a new fingerprint; its AI texts are now stale.
    bytes = Buffer.from("second version of the image");
    await database.db
      .update(core_files)
      .set({ fingerprint: createHash("sha256").update(bytes).digest("hex") })
      .where(eq(core_files.id, fileId));
    await processAltForFile(context(), fileId);

    expect(calls.vision).toBe(2);
    const analyses = await database.db
      .select()
      .from(core_files_alt_analysis)
      .where(eq(core_files_alt_analysis.fileId, fileId));
    expect(analyses).toHaveLength(2);
    expect(await altsOf(fileId)).toEqual({
      en: { origin: "ai", text: "A red bicycle." },
      pl: { origin: "human", text: "Mój rower" },
    });
  });

  it("waits for budget without calling the provider or burning a retry", async () => {
    const fileId = await insertFile();
    await database.db
      .update(core_ai_settings)
      .set({ monthlyBudgetUsd: "0.00000001" })
      .where(eq(core_ai_settings.id, 1));

    await expect(processAltForFile(context(), fileId)).rejects.toBeInstanceOf(
      QueueDeferError,
    );
    expect(calls.vision).toBe(0);
    const [state] = await database.db
      .select({ status: core_files_alt_state.status })
      .from(core_files_alt_state)
      .where(eq(core_files_alt_state.fileId, fileId));
    expect(state.status).toBe("waiting_budget");

    // Through the queue: the task returns to pending with its attempt given back.
    await database.db.delete(core_queue);
    await enqueueAltGeneration(context(), fileId);
    await processQueueTasks(context(), { queues: [ALT_QUEUE] });
    const [task] = await database.db.select().from(core_queue);
    expect(task).toMatchObject({ attempts: 0, status: "pending" });
    expect(task.availableAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("queues one task per image however often it is dispatched", async () => {
    await database.db.delete(core_queue);
    const fileId = await insertFile();

    const results = await Promise.all([
      enqueueAltGeneration(context(), fileId),
      enqueueAltGeneration(context(), fileId),
      enqueueAltGeneration(context(), fileId),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await database.db.select().from(core_queue)).toHaveLength(1);
  });

  it("recovers a task whose worker died, spending the attempt", async () => {
    await database.db.delete(core_queue);
    const fileId = await insertFile();
    await enqueueAltGeneration(context(), fileId);
    await database.db.update(core_queue).set({
      attempts: 1,
      reservedAt: new Date(Date.now() - 3_600_000),
      status: "processing",
    });

    await processQueueTasks(context(), { queues: [ALT_QUEUE] });

    const [task] = await database.db.select().from(core_queue);
    expect(task).toMatchObject({ attempts: 2, status: "completed" });
    expect(Object.keys(await altsOf(fileId)).sort()).toEqual(["en", "pl"]);
  });

  it("sweeps in bounded batches, skips opted-out files and wraps around", async () => {
    await database.db.delete(core_queue);
    await database.db.delete(core_files);
    const ids: number[] = [];
    for (let index = 0; index < 3; index++) ids.push(await insertFile());
    await insertFile({ altPolicy: "disabled" });
    await insertFile({ mimeType: "application/pdf" });
    await database.db
      .update(core_ai_settings)
      .set({ altBatchSize: 2, altScanCursor: 0 })
      .where(eq(core_ai_settings.id, 1));

    const first = await detectMissingAlt(context());
    const second = await detectMissingAlt(context());

    expect(first.enqueued).toBe(2);
    expect(second.enqueued).toBe(1);
    const queued = (await database.db.select().from(core_queue)).map(
      row => (row.payload as { fileId: number }).fileId,
    );
    expect(queued.sort((a, b) => a - b)).toEqual(ids);
    const [settings] = await database.db.select().from(core_ai_settings);
    expect(settings.altScanCursor).toBe(0);
  });
});
