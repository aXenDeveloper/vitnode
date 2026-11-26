import type { Context } from "hono";

import { and, eq, inArray, lte, or, sql } from "drizzle-orm";

import type { RichTextDocument } from "../../content/rich-text/document";
import type { EnvVitNode } from "../../middlewares/global.middleware";
import type { AutoTranslateFieldSource } from "./targets";

import {
  applyAutoTranslateSegments,
  AutoTranslateSegmentsError,
} from "../../content/auto-translate/segments";
import { zodRichTextDocument } from "../../content/rich-text/document";
import {
  core_content_ai_translation_jobs,
  core_content_ai_translations,
} from "../../database/content-translations";
import {
  contentTranslationCompletedEvent,
  contentTranslationFailedEvent,
} from "../../events/content-translations";
import { isAiError } from "../ai/errors";
import { QueueDeferError } from "../queue";
import {
  CONTENT_TRANSLATE_AI_ACTION,
  contentTranslateAiAction,
} from "./action";
import {
  contentTranslationSpendUsd,
  fitsContentTranslationBudget,
} from "./budget";
import { decideAutoTranslateField, SKIPPED_JOB_BACKOFF_MS } from "./service";
import { loadContentTranslationSettings } from "./settings";
import { autoTranslateTargetKey, loadAutoTranslateTargets } from "./targets";

type Job = typeof core_content_ai_translation_jobs.$inferSelect;

/** Long enough for one provider call and its checks, short enough to recover a dead worker. */
export const CONTENT_TRANSLATE_LEASE_MS = 3 * 60_000;
const WORKER_CONCURRENCY = 2;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const BUDGET_CODES = new Set(["AI_BUDGET_EXHAUSTED", "AI_DISABLED"]);
const SLOT_CODES = new Set(["AI_CONCURRENCY_LIMITED", "AI_RATE_LIMITED"]);
const CONFIG_CODES = new Set([
  "AI_ACTION_DISABLED",
  "AI_MODEL_INCOMPATIBLE",
  "AI_NOT_CONFIGURED",
  "AI_PRICING_MISSING",
]);

type Outcome =
  | { kind: "completed"; runId: null | number }
  | { kind: "defer"; status: "pending" | "waiting_budget"; until: Date }
  | { kind: "failed"; reason: string; retryAt: Date; retrying: boolean }
  | { kind: "skipped"; reason: string; retryAt?: Date };

type Db = Context["var"]["db"];

/**
 * Claims a job for this worker: only a pending one whose time has come, or a
 * running one whose lease expired. A conditional update, so of two workers -
 * on any number of instances - exactly one wins. "Now" is the database's
 * clock, the one a new job's `availableAt` defaults to, so a job queued a
 * moment ago is never skipped for an app clock that runs behind.
 */
export const claimJob = async (
  db: Db,
  id: number,
  owner: string,
): Promise<Job | null> => {
  const now = new Date();
  const jobs = core_content_ai_translation_jobs;
  const [job] = await db
    .update(jobs)
    .set({
      attempts: sql`${jobs.attempts} + 1`,
      leaseExpiresAt: new Date(now.getTime() + CONTENT_TRANSLATE_LEASE_MS),
      leaseOwner: owner,
      status: "running",
    })
    .where(
      and(
        eq(jobs.id, id),
        or(
          and(
            inArray(jobs.status, ["pending", "waiting_budget"]),
            lte(jobs.availableAt, sql`now()`),
          ),
          and(eq(jobs.status, "running"), lte(jobs.leaseExpiresAt, sql`now()`)),
        ),
      ),
    )
    .returning();

  return job ?? null;
};

/** Writes the outcome only while this worker still holds the lease. */
export const finishJob = async (
  db: Db,
  job: Job,
  owner: string,
  outcome: Outcome,
): Promise<void> => {
  const now = new Date();
  const jobs = core_content_ai_translation_jobs;
  const values =
    outcome.kind === "completed"
      ? {
          availableAt: now,
          completedAt: now,
          reason: null,
          runId: outcome.runId,
          status: "completed" as const,
        }
      : outcome.kind === "defer"
        ? {
            attempts: sql`GREATEST(${jobs.attempts} - 1, 0)`,
            availableAt: outcome.until,
            status: outcome.status,
          }
        : outcome.kind === "failed"
          ? {
              availableAt: outcome.retryAt,
              reason: outcome.reason.slice(0, 40),
              status: outcome.retrying
                ? ("pending" as const)
                : ("failed" as const),
            }
          : {
              availableAt: outcome.retryAt ?? now,
              completedAt: now,
              reason: outcome.reason.slice(0, 40),
              status: "skipped" as const,
            };

  await db
    .update(jobs)
    .set({ ...values, leaseExpiresAt: null, leaseOwner: null })
    .where(and(eq(jobs.id, job.id), eq(jobs.leaseOwner, owner)));
};

const readCurrent = async (
  c: Context,
  job: Job,
): Promise<AutoTranslateFieldSource | null> => {
  const targets = await loadAutoTranslateTargets(
    c,
    [{ contentTypeId: job.contentTypeId, id: job.recordId }],
    { locale: job.targetLocale, persist: true },
  );

  return (
    targets
      .get(autoTranslateTargetKey(job.contentTypeId, job.recordId))
      ?.fields.get(job.field) ?? null
  );
};

const backoff = (attempts: number) =>
  new Date(Date.now() + Math.min(5 * MINUTE * 2 ** (attempts - 1), 6 * HOUR));

const translateJob = async (
  c: Context<EnvVitNode>,
  job: Job,
): Promise<Outcome> => {
  const db = c.get("db");
  const settings = await loadContentTranslationSettings(c);
  if (!settings.enabled) return { kind: "skipped", reason: "disabled" };

  const field = await readCurrent(c, job);
  if (!field) return { kind: "skipped", reason: "not_found" };
  if (field.fingerprint !== job.sourceFingerprint) {
    return { kind: "skipped", reason: "stale" };
  }

  const [stored] = await db
    .select({ id: core_content_ai_translations.id })
    .from(core_content_ai_translations)
    .where(
      and(
        eq(core_content_ai_translations.targetKind, job.targetKind),
        eq(core_content_ai_translations.contentTypeId, job.contentTypeId),
        eq(core_content_ai_translations.recordId, job.recordId),
        eq(core_content_ai_translations.field, job.field),
        eq(
          core_content_ai_translations.sourceFingerprint,
          job.sourceFingerprint,
        ),
        eq(core_content_ai_translations.targetLocale, job.targetLocale),
      ),
    )
    .limit(1);
  if (stored) return { kind: "completed", runId: null };

  const decision = decideAutoTranslateField({
    field,
    locale: job.targetLocale,
    mode: job.mode,
    settings,
  });
  if (decision.state !== "missing") {
    return {
      kind: "skipped",
      reason: decision.reason ?? decision.state,
      retryAt: new Date(Date.now() + SKIPPED_JOB_BACKOFF_MS),
    };
  }

  const sourceLocale =
    (field.detection.confident ? field.detection.locale : null) ??
    job.sourceLocaleHint;
  const input = {
    blocks: field.source.blocks,
    sourceLocale,
    targetLocale: job.targetLocale,
  };
  if (
    contentTranslateAiAction.measureInput &&
    contentTranslateAiAction.measureInput(input) >
      contentTranslateAiAction.defaults.maxInputCharacters
  ) {
    return {
      kind: "skipped",
      reason: "too_long",
      retryAt: new Date(Date.now() + SKIPPED_JOB_BACKOFF_MS),
    };
  }

  const ai = c.get("ai");
  const request = {
    action: CONTENT_TRANSLATE_AI_ACTION,
    idempotencyKey: `content-translate:${String(job.id)}:${String(job.attempts)}`,
    input,
    resource: { id: job.recordId, type: job.contentTypeId },
    sourceFingerprint: job.sourceFingerprint,
  };

  try {
    const estimate = await ai.estimateAsSystem(request);
    if (estimate.maxUsd === null) {
      return {
        kind: "failed",
        reason: "AI_PRICING_MISSING",
        retryAt: new Date(Date.now() + HOUR),
        retrying: false,
      };
    }
    const { periodEnd, spentUsd } = await contentTranslationSpendUsd(c);
    if (
      !fitsContentTranslationBudget(
        settings.monthlyBudgetUsd,
        spentUsd,
        estimate.maxUsd,
      )
    ) {
      const inAnHour = new Date(Date.now() + HOUR);

      return {
        kind: "defer",
        status: "waiting_budget",
        until: periodEnd < inAnHour ? periodEnd : inAnHour,
      };
    }

    const result = await ai.runAsSystem(request);
    let value: RichTextDocument;
    try {
      value = zodRichTextDocument.parse(
        applyAutoTranslateSegments(
          field.value,
          field.source,
          result.output.segments,
        ),
      );
    } catch (error) {
      return {
        kind: "failed",
        reason:
          error instanceof AutoTranslateSegmentsError
            ? "invalid_segments"
            : "invalid_document",
        retryAt: new Date(Date.now() + 24 * HOUR),
        retrying: false,
      };
    }

    const current = await readCurrent(c, job);
    if (!current) return { kind: "skipped", reason: "not_found" };

    await db
      .insert(core_content_ai_translations)
      .values({
        contentTypeId: job.contentTypeId,
        field: job.field,
        modelId: result.usage.modelId,
        promptVersion: contentTranslateAiAction.promptVersion,
        recordId: job.recordId,
        runId: result.runId,
        sourceFingerprint: job.sourceFingerprint,
        sourceLocale,
        targetKind: job.targetKind,
        targetLocale: job.targetLocale,
        value,
        supersededAt:
          current.fingerprint === job.sourceFingerprint ? null : new Date(),
      })
      .onConflictDoNothing();

    return { kind: "completed", runId: result.runId };
  } catch (error) {
    if (error instanceof QueueDeferError) throw error;
    const code = isAiError(error) ? error.code : "AI_FAILED";
    if (BUDGET_CODES.has(code)) {
      const { periodEnd } = await contentTranslationSpendUsd(c);
      const inAnHour = new Date(Date.now() + HOUR);

      return {
        kind: "defer",
        status: "waiting_budget",
        until: periodEnd < inAnHour ? periodEnd : inAnHour,
      };
    }
    if (SLOT_CODES.has(code)) {
      return {
        kind: "defer",
        status: "pending",
        until: new Date(Date.now() + MINUTE),
      };
    }
    if (CONFIG_CODES.has(code)) {
      return {
        kind: "failed",
        reason: code,
        retryAt: new Date(Date.now() + HOUR),
        retrying: false,
      };
    }
    if (code === "AI_INPUT_TOO_LARGE") {
      return {
        kind: "skipped",
        reason: "too_long",
        retryAt: new Date(Date.now() + SKIPPED_JOB_BACKOFF_MS),
      };
    }
    if (code === "AI_INVALID_OUTPUT") {
      return {
        kind: "failed",
        reason: code,
        retryAt: new Date(Date.now() + 24 * HOUR),
        retrying: false,
      };
    }

    const retrying = job.attempts < job.maxAttempts;

    return {
      kind: "failed",
      reason: code,
      retryAt: retrying
        ? backoff(job.attempts)
        : new Date(Date.now() + 24 * HOUR),
      retrying,
    };
  }
};

const emitOutcome = async (c: Context, job: Job, outcome: Outcome) => {
  const target = {
    contentTypeId: job.contentTypeId,
    field: job.field,
    recordId: job.recordId,
    targetLocale: job.targetLocale,
  };
  const events = c.get("events");
  if (outcome.kind === "completed") {
    await events.emit(contentTranslationCompletedEvent, {
      ...target,
      latencyMs: Math.max(0, Date.now() - job.requestedAt.getTime()),
      runId: outcome.runId,
    });
  } else if (outcome.kind !== "defer") {
    await events.emit(contentTranslationFailedEvent, {
      ...target,
      reason: outcome.reason,
      retrying: outcome.kind === "failed" && outcome.retrying,
    });
  }
};

/**
 * Runs queued translation jobs, a couple at a time. Each job is claimed under
 * a lease, re-checked against the current source before and after the model
 * call, and finished only by the worker that still owns it. Jobs that wait for
 * the budget or a free AI slot put the whole queue task off without spending
 * an attempt; they are retried from their stored state. Server-only.
 *
 * @throws {QueueDeferError} When a job is waiting, so the queue runs the task
 * again once the earliest one is due.
 */
export const processAutoTranslateJobs = async (
  c: Context<EnvVitNode>,
  jobIds: readonly number[],
): Promise<void> => {
  const db = c.get("db");
  const owner = crypto.randomUUID();
  const aiSettings = await c.get("ai").ledger().loadSettings();
  const concurrency = Math.max(
    1,
    Math.min(WORKER_CONCURRENCY, aiSettings.systemConcurrency),
  );
  const waits: Date[] = [];
  let next = 0;

  const worker = async () => {
    while (next < jobIds.length) {
      const id = jobIds[next++];
      const job = await claimJob(db, id, owner);
      if (!job) {
        const [waiting] = await db
          .select({
            availableAt: core_content_ai_translation_jobs.availableAt,
            leaseExpiresAt: core_content_ai_translation_jobs.leaseExpiresAt,
            status: core_content_ai_translation_jobs.status,
          })
          .from(core_content_ai_translation_jobs)
          .where(eq(core_content_ai_translation_jobs.id, id));
        const dueAt =
          waiting?.status === "pending" || waiting?.status === "waiting_budget"
            ? waiting.availableAt
            : waiting?.status === "running"
              ? waiting.leaseExpiresAt
              : undefined;
        if (dueAt !== undefined) {
          waits.push(
            new Date(Math.max(dueAt?.getTime() ?? 0, Date.now() + 1000)),
          );
        }
        continue;
      }
      let outcome: Outcome;
      try {
        outcome = await translateJob(c, job);
      } catch (error) {
        outcome = {
          kind: "failed",
          reason: error instanceof Error ? error.name : "error",
          retryAt: backoff(job.attempts),
          retrying: job.attempts < job.maxAttempts,
        };
      }
      await finishJob(db, job, owner, outcome);
      await emitOutcome(c, job, outcome);
      if (outcome.kind === "defer") waits.push(outcome.until);
      if (outcome.kind === "failed" && outcome.retrying) {
        waits.push(outcome.retryAt);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));

  if (waits.length > 0) {
    const until = new Date(Math.min(...waits.map(date => date.getTime())));
    throw new QueueDeferError(until, "Translation jobs are waiting");
  }
};
