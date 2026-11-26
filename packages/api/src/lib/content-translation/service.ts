import type { Context } from "hono";
import type { z } from "zod";

import { and, eq, gte, inArray, or, sql } from "drizzle-orm";

import type {
  AutoTranslateFieldResult,
  AutoTranslateReason,
  AutoTranslateResponse,
  zodAutoTranslateLookupBody,
  zodAutoTranslateRequestBody,
} from "../../content/auto-translate/schemas";
import type { EnvVitNode } from "../../middlewares/global.middleware";
import type { ContentTranslationSettings } from "./settings";
import type { AutoTranslateFieldSource, AutoTranslateTarget } from "./targets";

import { AUTO_TRANSLATE_REASONS } from "../../content/auto-translate/schemas";
import {
  core_content_ai_translation_jobs,
  core_content_ai_translations,
} from "../../database/content-translations";
import { contentTranslationServedEvent } from "../../events/content-translations";
import { contentTranslateQueueTask } from "../../modules/content/tasks/content-translate.task";
import { processQueueTasksByIds } from "../../modules/queue/lib/process-queue-tasks";
import { runAfterResponse } from "../after-response";
import {
  contentTranslationSpendUsd,
  fitsContentTranslationBudget,
} from "./budget";
import { primaryLocale } from "./detect";
import { loadContentTranslationSettings } from "./settings";
import { autoTranslateTargetKey, loadAutoTranslateTargets } from "./targets";

export const CONTENT_TRANSLATE_QUEUE = "ai";
export const CONTENT_TRANSLATE_TARGET_KIND = "content";

type Mode = "automatic" | "lookup" | "manual";

type JobRow = Pick<
  typeof core_content_ai_translation_jobs.$inferSelect,
  "availableAt" | "mode" | "reason" | "status"
>;

interface StoredTranslation {
  sourceLocale: null | string;
  value: unknown;
}

/** What one field resolves to, plus whether a request should queue it. */
export type FieldDecision = AutoTranslateFieldResult & { queue?: boolean };

const KNOWN_REASONS: ReadonlySet<string> = new Set(AUTO_TRANSLATE_REASONS);
const TRANSIENT_SKIPS: ReadonlySet<string> = new Set([
  "disabled",
  "not_found",
  "stale",
]);

/**
 * Decides one field's state without side effects: a stale client, the site
 * switch and allowlist, a saved translation, the skip rules, the language,
 * and the job already queued for this exact source version. Pure, so every
 * rule is covered by one test table.
 */
export const decideAutoTranslateField = ({
  expectedFingerprint,
  field,
  job,
  locale,
  mode,
  now = new Date(),
  settings,
  stored,
}: {
  expectedFingerprint?: string;
  field: AutoTranslateFieldSource;
  job?: JobRow;
  locale: string;
  mode: Mode;
  now?: Date;
  settings: Pick<ContentTranslationSettings, "enabled" | "locales">;
  stored?: StoredTranslation;
}): FieldDecision => {
  const base = { fingerprint: field.fingerprint, name: field.name };
  if (expectedFingerprint && expectedFingerprint !== field.fingerprint) {
    return { ...base, state: "stale" };
  }
  if (!settings.enabled) {
    return { ...base, reason: "disabled", state: "unavailable" };
  }

  const target = primaryLocale(locale);
  const allowed = new Set(settings.locales.map(primaryLocale));
  if (!allowed.has(target)) {
    return { ...base, reason: "locale", state: "skipped" };
  }
  if (stored) {
    return {
      ...base,
      sourceLocale: stored.sourceLocale,
      state: "ready",
      value: stored.value as FieldDecision["value"],
    };
  }

  const { detection, textClass } = field;
  if (textClass.kind === "hard_skip") {
    return { ...base, reason: textClass.reason, state: "skipped" };
  }
  const detected = detection.locale ? primaryLocale(detection.locale) : null;
  if (detection.confident && detected === target) {
    return { ...base, sourceLocale: detection.locale, state: "original" };
  }
  if (detection.confident && detected !== null && !allowed.has(detected)) {
    return {
      ...base,
      reason: "unsupported_language",
      sourceLocale: detection.locale,
      state: "skipped",
    };
  }
  if (
    mode === "lookup" &&
    (job?.status === "pending" || job?.status === "running")
  ) {
    return { ...base, state: "pending" };
  }
  if (mode !== "manual") {
    if (textClass.kind === "soft_skip") {
      return { ...base, reason: "single_word", state: "skipped" };
    }
    if (!detection.confident) {
      return { ...base, reason: "uncertain_language", state: "skipped" };
    }
  }

  if (job) {
    if (job.status === "pending" || job.status === "running") {
      return { ...base, state: "pending" };
    }
    if (job.status === "waiting_budget") {
      return { ...base, reason: "budget", state: "unavailable" };
    }
    if (job.status === "failed" && job.availableAt > now) {
      return { ...base, reason: "failed", state: "unavailable" };
    }
    if (
      job.status === "skipped" &&
      job.reason !== null &&
      !TRANSIENT_SKIPS.has(job.reason) &&
      !(mode === "manual" && job.mode === "automatic")
    ) {
      return {
        ...base,
        reason: KNOWN_REASONS.has(job.reason)
          ? (job.reason as AutoTranslateReason)
          : "failed",
        state: KNOWN_REASONS.has(job.reason) ? "skipped" : "unavailable",
      };
    }
  }

  return mode === "lookup"
    ? { ...base, state: "missing" }
    : { ...base, queue: true, state: "missing" };
};

type Db = Context["var"]["db"];

const jobKey = (
  contentTypeId: string,
  recordId: string,
  field: string,
  fingerprint: string,
) => `${contentTypeId}\u0000${recordId}\u0000${field}\u0000${fingerprint}`;

const loadState = async (
  db: Db,
  targets: Map<string, AutoTranslateTarget>,
  locale: string,
) => {
  const fingerprints = [...targets.values()].flatMap(target =>
    [...target.fields.values()].map(field => field.fingerprint),
  );
  if (fingerprints.length === 0) {
    return {
      jobs: new Map<string, JobRow>(),
      stored: new Map<string, StoredTranslation>(),
    };
  }
  const recordIds = [...targets.values()].map(target => target.recordId);
  const where = (
    table:
      | typeof core_content_ai_translation_jobs
      | typeof core_content_ai_translations,
  ) =>
    and(
      eq(table.targetKind, CONTENT_TRANSLATE_TARGET_KIND),
      eq(table.targetLocale, locale),
      inArray(table.recordId, recordIds),
      inArray(table.sourceFingerprint, fingerprints),
    );

  const [stored, jobs] = await Promise.all([
    db
      .select({
        contentTypeId: core_content_ai_translations.contentTypeId,
        field: core_content_ai_translations.field,
        recordId: core_content_ai_translations.recordId,
        sourceFingerprint: core_content_ai_translations.sourceFingerprint,
        sourceLocale: core_content_ai_translations.sourceLocale,
        value: core_content_ai_translations.value,
      })
      .from(core_content_ai_translations)
      .where(where(core_content_ai_translations)),
    db
      .select({
        availableAt: core_content_ai_translation_jobs.availableAt,
        contentTypeId: core_content_ai_translation_jobs.contentTypeId,
        field: core_content_ai_translation_jobs.field,
        mode: core_content_ai_translation_jobs.mode,
        reason: core_content_ai_translation_jobs.reason,
        recordId: core_content_ai_translation_jobs.recordId,
        sourceFingerprint: core_content_ai_translation_jobs.sourceFingerprint,
        status: core_content_ai_translation_jobs.status,
      })
      .from(core_content_ai_translation_jobs)
      .where(where(core_content_ai_translation_jobs)),
  ]);

  return {
    jobs: new Map(
      jobs.map(row => [
        jobKey(
          row.contentTypeId,
          row.recordId,
          row.field,
          row.sourceFingerprint,
        ),
        row,
      ]),
    ),
    stored: new Map(
      stored.map(row => [
        jobKey(
          row.contentTypeId,
          row.recordId,
          row.field,
          row.sourceFingerprint,
        ),
        { sourceLocale: row.sourceLocale, value: row.value },
      ]),
    ),
  };
};

type LookupBody = z.infer<typeof zodAutoTranslateLookupBody>;
type RequestBody = z.infer<typeof zodAutoTranslateRequestBody>;

interface BatchBody {
  items: {
    contentTypeId: string;
    fields: { fingerprint?: string; name: string }[];
    id: number | string;
  }[];
  locale: string;
}

interface Resolved {
  decisions: {
    contentTypeId: string;
    fields: { decision: FieldDecision; source?: AutoTranslateFieldSource }[];
    id: string;
    target?: AutoTranslateTarget;
  }[];
}

interface WantedField {
  contentTypeId: string;
  decision: FieldDecision;
  fingerprint: string;
  recordId: string;
}

const resolveBatch = async (
  c: Context,
  body: BatchBody,
  mode: Mode,
): Promise<Resolved> => {
  const settings = await loadContentTranslationSettings(c);
  const targets = settings.enabled
    ? await loadAutoTranslateTargets(c, body.items, {
        locale: body.locale,
        persist: mode !== "lookup",
      })
    : new Map<string, AutoTranslateTarget>();
  const { jobs, stored } = await loadState(c.get("db"), targets, body.locale);

  return {
    decisions: body.items.map(item => {
      const target = targets.get(
        autoTranslateTargetKey(item.contentTypeId, item.id),
      );

      return {
        contentTypeId: item.contentTypeId,
        fields: item.fields.map(requested => {
          const source = target?.fields.get(requested.name);
          if (!target || !source) {
            return {
              decision: {
                fingerprint: null,
                name: requested.name,
                reason: settings.enabled ? "not_found" : "disabled",
                state: "unavailable",
              },
            };
          }
          const key = jobKey(
            target.contentTypeId,
            target.recordId,
            source.name,
            source.fingerprint,
          );

          return {
            decision: decideAutoTranslateField({
              expectedFingerprint: requested.fingerprint,
              field: source,
              job: jobs.get(key),
              locale: body.locale,
              mode,
              settings,
              stored: stored.get(key),
            }),
            source,
          };
        }),
        id: String(item.id),
        target,
      };
    }),
  };
};

const toResponse = (
  locale: string,
  resolved: Resolved,
): AutoTranslateResponse => ({
  items: resolved.decisions.map(item => ({
    contentTypeId: item.contentTypeId,
    fields: item.fields.map(({ decision }) => {
      const { queue: _queue, ...result } = decision;

      return result;
    }),
    id: item.id,
  })),
  locale,
});

const emitServed = async (
  c: Context,
  locale: string,
  mode: Mode,
  resolved: Resolved,
  queued: number,
) => {
  const states = resolved.decisions.flatMap(item =>
    item.fields.map(field => field.decision.state),
  );
  await c.get("events").emit(contentTranslationServedEvent, {
    locale,
    mode,
    pending: states.filter(state => state === "pending").length,
    queued,
    ready: states.filter(state => state === "ready").length,
    skipped: states.filter(state => state === "skipped").length,
  });
};

/**
 * Answers which fields of a batch have a translation in `locale`, with the
 * saved translations themselves. Read-only: it never queues work, stores
 * anything or calls a model, so list and detail loaders can call it freely.
 * Server-only.
 */
export const lookupAutoTranslations = async (
  c: Context,
  body: LookupBody,
): Promise<AutoTranslateResponse> => {
  const resolved = await resolveBatch(c, body, "lookup");
  await emitServed(c, body.locale, "lookup", resolved, 0);

  return toResponse(body.locale, resolved);
};

/** How long an automatic skip stands before the same version is looked at again. */
export const SKIPPED_JOB_BACKOFF_MS = 30 * 24 * 3_600_000;

const wantedFields = (resolved: Resolved): WantedField[] =>
  resolved.decisions.flatMap(({ fields, target }) =>
    target
      ? fields.flatMap(({ decision, source }) =>
          decision.queue && source
            ? [
                {
                  contentTypeId: target.contentTypeId,
                  decision,
                  fingerprint: source.fingerprint,
                  recordId: target.recordId,
                },
              ]
            : [],
        )
      : [],
  );

const queueJobs = async (
  c: Context<EnvVitNode>,
  {
    allowed,
    hint,
    locale,
    mode,
    requestedBy,
  }: {
    allowed: WantedField[];
    hint: null | string;
    locale: string;
    mode: "automatic" | "manual";
    requestedBy: null | number;
  },
): Promise<Set<string>> => {
  const queuedKeys = new Set<string>();
  if (allowed.length === 0) return queuedKeys;

  const now = new Date();
  const queueId = await c.get("db").transaction(async tx => {
    const jobs = core_content_ai_translation_jobs;
    const rows = await tx
      .insert(jobs)
      .values(
        allowed.map(({ contentTypeId, decision, fingerprint, recordId }) => ({
          contentTypeId,
          field: decision.name,
          mode,
          recordId,
          requestedBy,
          sourceFingerprint: fingerprint,
          sourceLocaleHint: hint,
          targetKind: CONTENT_TRANSLATE_TARGET_KIND,
          targetLocale: locale,
        })),
      )
      .onConflictDoUpdate({
        set: {
          attempts: 0,
          availableAt: sql`now()`,
          completedAt: null,
          leaseExpiresAt: null,
          leaseOwner: null,
          mode: sql`excluded."mode"`,
          reason: null,
          requestedAt: now,
          requestedBy: sql`excluded."requestedBy"`,
          sourceLocaleHint: sql`excluded."sourceLocaleHint"`,
          status: "pending",
        },
        setWhere: or(
          and(
            inArray(jobs.status, ["completed", "failed", "skipped"]),
            sql`${jobs.availableAt} <= now()`,
          ),
          and(
            eq(jobs.status, "skipped"),
            eq(jobs.mode, "automatic"),
            sql`excluded."mode" = 'manual'`,
          ),
        ),
        target: [
          jobs.targetKind,
          jobs.contentTypeId,
          jobs.recordId,
          jobs.field,
          jobs.sourceFingerprint,
          jobs.targetLocale,
        ],
      })
      .returning({
        contentTypeId: jobs.contentTypeId,
        field: jobs.field,
        id: jobs.id,
        recordId: jobs.recordId,
        sourceFingerprint: jobs.sourceFingerprint,
      });
    for (const row of rows) {
      queuedKeys.add(
        jobKey(
          row.contentTypeId,
          row.recordId,
          row.field,
          row.sourceFingerprint,
        ),
      );
    }
    if (rows.length === 0) return null;

    const { id } = await c
      .get("queue")
      .dispatch(
        contentTranslateQueueTask,
        { jobIds: rows.map(row => row.id) },
        { queue: CONTENT_TRANSLATE_QUEUE, tx },
      );

    return id;
  });

  if (queueId !== null && mode === "automatic") {
    runAfterResponse(
      c,
      processQueueTasksByIds(c, [queueId]).catch(async (error: unknown) => {
        await c
          .get("log")
          .warn(
            `[Content translation] Immediate run deferred to the queue: ${error instanceof Error ? error.message : String(error)}`,
          );
      }),
    );
  }

  return queuedKeys;
};

const queueRequestedTranslations = async (
  c: Context<EnvVitNode>,
  body: RequestBody,
): Promise<AutoTranslateResponse> => {
  const resolved = await resolveBatch(c, body, body.mode);
  const user = c.get("user");
  const wanted = wantedFields(resolved);

  if (wanted.length === 0) {
    await emitServed(c, body.locale, body.mode, resolved, 0);

    return toResponse(body.locale, resolved);
  }

  const refuse = (reason: AutoTranslateReason, from = 0) => {
    for (const { decision } of wanted.slice(from)) {
      decision.state = "unavailable";
      decision.reason = reason;
    }
  };

  if (!user) {
    refuse("sign_in");
    await emitServed(c, body.locale, body.mode, resolved, 0);

    return toResponse(body.locale, resolved);
  }

  const [settings, { spentUsd }] = await Promise.all([
    loadContentTranslationSettings(c),
    contentTranslationSpendUsd(c),
  ]);
  if (!fitsContentTranslationBudget(settings.monthlyBudgetUsd, spentUsd)) {
    refuse("budget");
    await emitServed(c, body.locale, body.mode, resolved, 0);

    return toResponse(body.locale, resolved);
  }

  const db = c.get("db");
  const hourAgo = new Date(Date.now() - 3_600_000);
  const [usage] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(core_content_ai_translation_jobs)
    .where(
      and(
        eq(core_content_ai_translation_jobs.requestedBy, user.id),
        gte(core_content_ai_translation_jobs.requestedAt, hourAgo),
      ),
    );
  const remaining = Math.max(0, settings.userHourlyLimit - (usage?.total ?? 0));
  refuse("limited", remaining);
  const allowed = wanted.slice(0, remaining);
  const hint =
    body.mode === "manual" &&
    body.sourceLocale &&
    settings.locales
      .map(primaryLocale)
      .includes(primaryLocale(body.sourceLocale))
      ? body.sourceLocale
      : null;

  const queuedKeys = await queueJobs(c, {
    allowed,
    hint,
    locale: body.locale,
    mode: body.mode,
    requestedBy: user.id,
  });
  for (const { decision } of allowed) decision.state = "pending";

  await emitServed(c, body.locale, body.mode, resolved, queuedKeys.size);

  return toResponse(body.locale, resolved);
};

const MANUAL_TRANSLATION_WAIT_MS = 20_000;

const translateNow = async (
  c: Context<EnvVitNode>,
  body: RequestBody,
  response: AutoTranslateResponse,
): Promise<AutoTranslateResponse | null> => {
  const jobs = core_content_ai_translation_jobs;
  const pending = response.items.flatMap(item =>
    item.fields.flatMap(({ fingerprint, name, state }) =>
      state === "pending" && fingerprint
        ? [
            and(
              eq(jobs.contentTypeId, item.contentTypeId),
              eq(jobs.recordId, item.id),
              eq(jobs.field, name),
              eq(jobs.sourceFingerprint, fingerprint),
            ),
          ]
        : [],
    ),
  );
  if (pending.length === 0) return null;

  const rows = await c
    .get("db")
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.targetKind, CONTENT_TRANSLATE_TARGET_KIND),
        eq(jobs.targetLocale, body.locale),
        inArray(jobs.status, ["pending", "running"]),
        or(...pending),
      ),
    );
  if (rows.length === 0) return null;

  const { processAutoTranslateJobs } = await import("./worker");
  const run = processAutoTranslateJobs(
    c,
    rows.map(row => row.id),
  ).then(
    () => true,
    () => true,
  );
  runAfterResponse(c, run);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finished = await Promise.race([
    run,
    new Promise<false>(resolve => {
      timer = setTimeout(() => {
        resolve(false);
      }, MANUAL_TRANSLATION_WAIT_MS);
    }),
  ]);
  clearTimeout(timer);
  if (!finished) return null;

  return toResponse(body.locale, await resolveBatch(c, body, "lookup"));
};

/**
 * {@link lookupAutoTranslations}, then queues every eligible miss for a
 * signed-in reader - one job per field and source version, shared by every
 * reader and API instance - within the reader's hourly limit and the monthly
 * translation budget. The job rows and their queue task are written in one
 * transaction, and the worker starts right after the response. A `manual`
 * request translates its fields before answering, so the reader's click
 * gets the translation itself, and falls back to `pending` after 20 seconds.
 * Server-only.
 */
export const requestAutoTranslations = async (
  c: Context<EnvVitNode>,
  body: RequestBody,
): Promise<AutoTranslateResponse> => {
  const response = await queueRequestedTranslations(c, body);
  if (body.mode !== "manual" || !c.get("user")) return response;

  return (await translateNow(c, body, response)) ?? response;
};

export const queueRecordAutoTranslations = async (
  c: Context<EnvVitNode>,
  {
    contentTypeId,
    fields,
    ids,
  }: {
    contentTypeId: string;
    fields: readonly string[];
    ids: readonly (number | string)[];
  },
): Promise<number> => {
  if (ids.length === 0 || fields.length === 0) return 0;
  const settings = await loadContentTranslationSettings(c);
  if (!settings.enabled) return 0;
  const { spentUsd } = await contentTranslationSpendUsd(c);
  if (!fitsContentTranslationBudget(settings.monthlyBudgetUsd, spentUsd)) {
    return 0;
  }

  let queued = 0;
  for (const locale of settings.locales) {
    const resolved = await resolveBatch(
      c,
      {
        items: ids.map(id => ({
          contentTypeId,
          fields: fields.map(name => ({ name })),
          id,
        })),
        locale,
      },
      "automatic",
    );
    const keys = await queueJobs(c, {
      allowed: wantedFields(resolved),
      hint: null,
      locale,
      mode: "automatic",
      requestedBy: null,
    });
    queued += keys.size;
  }

  return queued;
};
