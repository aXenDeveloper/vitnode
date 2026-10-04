import type { Context } from "hono";

import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { createHash } from "node:crypto";

import type { EnvVitNode } from "../../middlewares/global.middleware";
import type { AiSettingsSnapshot } from "./ledger";

import { core_ai_runs, core_ai_settings } from "../../../database/ai";
import {
  core_files,
  core_files_alt,
  core_files_alt_analysis,
  core_files_alt_state,
} from "../../../database/files";
import { core_languages } from "../../../database/languages";
import { QueueDeferError } from "../queue";
import {
  ALT_BASE_LANGUAGE,
  ALT_GENERATE_AI_ACTION,
  ALT_IMAGE_MEDIA_TYPES,
  ALT_TRANSLATE_AI_ACTION,
} from "./alt-actions";
import { isAiError } from "./errors";
import { periodContaining } from "./periods";

export const ALT_QUEUE = "ai";
export const ALT_TASK_NAME = "alt-generate";
/** The largest original the job will read; bigger files are skipped. */
export const ALT_MAX_SOURCE_BYTES = 20 * 1024 * 1024;
/** Longest edge of the copy sent to the provider. */
const ALT_MAX_EDGE_PX = 1024;
/** Files looked at per detection run, beyond the ones enqueued. */
const ALT_SCAN_WINDOW = 200;

type AltStatus = (typeof core_files_alt_state.$inferInsert)["status"];

type Db = Context["var"]["db"];

const isAltImage = (mimeType: null | string): boolean =>
  (ALT_IMAGE_MEDIA_TYPES as readonly string[]).includes(mimeType ?? "");

export const altDedupeKey = (fileId: number) => `alt:${fileId}`;

const setAltState = async (
  db: Db,
  fileId: number,
  status: AltStatus,
  lastError: null | string = null,
) => {
  await db
    .insert(core_files_alt_state)
    .values({ fileId, lastError, status })
    .onConflictDoUpdate({
      set: { lastError, status, updatedAt: new Date() },
      target: core_files_alt_state.fileId,
    });
};

/**
 * The languages ALT is written in: every registered site language, or the
 * subset an admin chose. `core_languages` has no "active" flag - registered
 * is available.
 */
export const altLanguages = async (
  db: Db,
  settings: Pick<AiSettingsSnapshot, "altLanguages">,
): Promise<string[]> => {
  const rows = await db
    .select({ code: core_languages.code })
    .from(core_languages)
    .orderBy(asc(core_languages.code));
  const codes = rows.map(row => row.code);

  return settings.altLanguages
    ? codes.filter(code => settings.altLanguages?.includes(code))
    : codes;
};

/**
 * Languages a file still needs an AI description in. A human row - even an
 * intentionally empty one - is never "missing". An AI row written for an
 * older version of the file is.
 */
export const missingAltLanguages = (
  rows: {
    fileFingerprint: null | string;
    languageCode: string;
    origin: string;
  }[],
  languages: string[],
  fingerprint: null | string,
): string[] =>
  languages.filter(code => {
    const row = rows.find(entry => entry.languageCode === code);
    if (!row) return true;
    if (row.origin === "human") return false;

    return fingerprint !== null && row.fileFingerprint !== fingerprint;
  });

/** Queues one image. Durable dedupe: a file already queued is queued once. */
export const enqueueAltGeneration = async (
  c: Context,
  fileId: number,
): Promise<boolean> => {
  const { deduplicated } = await c.get("queue").dispatch({
    dedupeKey: altDedupeKey(fileId),
    maxAttempts: 3,
    name: ALT_TASK_NAME,
    payload: { fileId },
    pluginId: "@vitnode/core",
    queue: ALT_QUEUE,
  });
  if (!deduplicated) await setAltState(c.get("db"), fileId, "pending");

  return !deduplicated;
};

/**
 * Called after an upload: an image gets its ALT job right away, when the
 * feature is on. A failure here never fails the upload - the hourly sweep is
 * the repair path.
 */
export const enqueueAltAfterUpload = async (
  c: Context,
  file: { id: number; mimeType: null | string },
): Promise<void> => {
  if (!isAltImage(file.mimeType)) return;
  try {
    const settings = await c.get("ai").ledger().loadSettings();
    if (!settings.enabled || !settings.altEnabled) return;
    await enqueueAltGeneration(c, file.id);
  } catch {
    /* the sweep catches up */
  }
};

/**
 * The repair sweep: bounded batches in id order from a stored cursor, so it
 * resumes where it stopped. When it reaches the end it starts over, so new
 * languages and missed uploads are always found again - nothing starves.
 */
export const detectMissingAlt = async (
  c: Context<EnvVitNode>,
): Promise<{ enqueued: number; scanned: number }> => {
  const db = c.get("db");
  const ledger = c.get("ai").ledger();
  const settings = await ledger.loadSettings();
  if (!settings.enabled || !settings.altEnabled) {
    return { enqueued: 0, scanned: 0 };
  }

  const [row] = await db
    .select({ cursor: core_ai_settings.altScanCursor })
    .from(core_ai_settings)
    .where(eq(core_ai_settings.id, 1));
  const cursor = row?.cursor ?? 0;
  const languages = await altLanguages(db, settings);
  if (languages.length === 0) return { enqueued: 0, scanned: 0 };

  const files = await db
    .select({
      fingerprint: core_files.fingerprint,
      id: core_files.id,
    })
    .from(core_files)
    .where(
      and(
        gt(core_files.id, cursor),
        eq(core_files.altPolicy, "automatic"),
        inArray(core_files.mimeType, [...ALT_IMAGE_MEDIA_TYPES]),
      ),
    )
    .orderBy(asc(core_files.id))
    .limit(ALT_SCAN_WINDOW);

  const states =
    files.length === 0
      ? []
      : await db
          .select({
            fileId: core_files_alt_state.fileId,
            status: core_files_alt_state.status,
            updatedAt: core_files_alt_state.updatedAt,
          })
          .from(core_files_alt_state)
          .where(
            inArray(
              core_files_alt_state.fileId,
              files.map(file => file.id),
            ),
          );
  const backOff = new Set(
    states
      .filter(
        state =>
          (state.status === "failed" || state.status === "skipped") &&
          Date.now() - state.updatedAt.getTime() < ALT_RETRY_AFTER_MS,
      )
      .map(state => state.fileId),
  );

  const rows =
    files.length === 0
      ? []
      : await db
          .select({
            fileFingerprint: core_files_alt.fileFingerprint,
            fileId: core_files_alt.fileId,
            languageCode: core_files_alt.languageCode,
            origin: core_files_alt.origin,
          })
          .from(core_files_alt)
          .where(
            inArray(
              core_files_alt.fileId,
              files.map(file => file.id),
            ),
          );

  let enqueued = 0;
  let lastId = cursor;
  for (const file of files) {
    if (enqueued >= settings.altBatchSize) break;
    lastId = file.id;
    // A file that just failed or was unreadable waits its back-off, so the
    // sweep never spends the budget on the same broken file every hour.
    if (backOff.has(file.id)) continue;
    const missing = missingAltLanguages(
      rows.filter(entry => entry.fileId === file.id),
      languages,
      file.fingerprint,
    );
    if (missing.length === 0) continue;
    if (await enqueueAltGeneration(c, file.id)) enqueued += 1;
  }

  // Wrap to the start once the end was reached, so the next sweep revisits
  // every image - a language added since is noticed there.
  const nextCursor =
    files.length < ALT_SCAN_WINDOW && enqueued < settings.altBatchSize
      ? 0
      : lastId;
  await db
    .update(core_ai_settings)
    .set({
      altScanCursor: nextCursor,
      altScanStartedAt: cursor === 0 ? new Date() : undefined,
    })
    .where(eq(core_ai_settings.id, 1));

  return { enqueued, scanned: files.length };
};

/** A bounded copy of the image for the provider, and the original's fingerprint. */
const prepareImage = async (
  c: Context,
  file: { key: string; mimeType: null | string },
): Promise<null | {
  bytes: Uint8Array;
  fingerprint: string;
  mediaType: (typeof ALT_IMAGE_MEDIA_TYPES)[number];
}> => {
  const original = await c
    .get("storage")
    .readBytes(file.key, ALT_MAX_SOURCE_BYTES);
  if (!original) return null;
  const fingerprint = createHash("sha256").update(original).digest("hex");
  const mediaType = file.mimeType as (typeof ALT_IMAGE_MEDIA_TYPES)[number];

  try {
    const { default: sharp } = await import("sharp");
    const resized = await sharp(original, { animated: false })
      .resize(ALT_MAX_EDGE_PX, ALT_MAX_EDGE_PX, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();

    return { bytes: resized, fingerprint, mediaType: "image/webp" };
  } catch {
    // Without sharp the original goes as it is - still bounded by its size.
    return { bytes: original, fingerprint, mediaType };
  }
};

/**
 * Writes one AI description, only if a person has not written that language
 * and the file is still the version it was written for. Never overwrites a
 * human row; never writes for a file whose policy changed meanwhile.
 */
export const writeAiAlt = async (
  db: Db,
  {
    fileId,
    fingerprint,
    languageCode,
    runId,
    text,
  }: {
    fileId: number;
    fingerprint: string;
    languageCode: string;
    runId: null | number;
    text: string;
  },
): Promise<boolean> => {
  const result = await db.execute<{ id: number }>(sql`
    INSERT INTO ${core_files_alt}
      ("fileId", "languageCode", "text", "origin", "fileFingerprint", "runId", "updatedAt")
    SELECT ${fileId}, ${languageCode}, ${text}, 'ai', ${fingerprint}, ${runId}, now()
    WHERE EXISTS (
      SELECT 1 FROM ${core_files}
      WHERE ${core_files.id} = ${fileId}
        AND ${core_files.fingerprint} = ${fingerprint}
        AND ${core_files.altPolicy} = 'automatic'
    )
    ON CONFLICT ("fileId", "languageCode") DO UPDATE SET
      "text" = excluded."text",
      "fileFingerprint" = excluded."fileFingerprint",
      "runId" = excluded."runId",
      "updatedAt" = now()
    WHERE ${core_files_alt}."origin" = 'ai'
      AND ${core_files_alt}."fileFingerprint" IS DISTINCT FROM excluded."fileFingerprint"
    RETURNING "id"
  `);

  return result.length > 0;
};

const deferForBudget = async (
  db: Db,
  fileId: number,
  settings: AiSettingsSnapshot,
): Promise<never> => {
  await setAltState(db, fileId, "waiting_budget");
  // The budget frees up at the start of the next period - no point asking
  // the provider, or burning a retry, before then. Checked hourly meanwhile in
  // case an admin raises the budget.
  const nextPeriod = periodContaining(
    new Date(),
    "month",
    settings.timeZone,
  ).end;
  const inAnHour = new Date(Date.now() + 3_600_000);
  throw new QueueDeferError(
    nextPeriod < inAnHour ? nextPeriod : inAnHour,
    "Waiting for the AI budget",
  );
};

const BUDGET_CODES = new Set(["AI_BUDGET_EXHAUSTED", "AI_DISABLED"]);
const CONFIG_CODES = new Set([
  "AI_ACTION_DISABLED",
  "AI_MODEL_INCOMPATIBLE",
  "AI_NOT_CONFIGURED",
  "AI_PRICING_MISSING",
]);

/** Files that failed or could not be read are revisited at most this often. */
export const ALT_RETRY_AFTER_MS = 24 * 3_600_000;

/**
 * One image, end to end: check, read, describe once, translate into the
 * missing languages, write conditionally. Every write rechecks the file's
 * version; persisted results are reused on retry, so a crash costs at most
 * the call that was in flight.
 */
export const processAltForFile = async (
  c: Context<EnvVitNode>,
  fileId: number,
): Promise<{ written: string[] }> => {
  const db = c.get("db");
  const settings = await c.get("ai").ledger().loadSettings();
  if (!settings.enabled || !settings.altEnabled) {
    await deferForBudget(db, fileId, settings);
  }

  const [file] = await db
    .select({
      altPolicy: core_files.altPolicy,
      fingerprint: core_files.fingerprint,
      id: core_files.id,
      key: core_files.key,
      mimeType: core_files.mimeType,
    })
    .from(core_files)
    .where(eq(core_files.id, fileId));
  if (!file) return { written: [] };
  if (file.altPolicy !== "automatic" || !isAltImage(file.mimeType)) {
    await setAltState(db, fileId, "skipped");

    return { written: [] };
  }

  const languages = await altLanguages(db, settings);
  const existing = await db
    .select({
      fileFingerprint: core_files_alt.fileFingerprint,
      languageCode: core_files_alt.languageCode,
      origin: core_files_alt.origin,
    })
    .from(core_files_alt)
    .where(eq(core_files_alt.fileId, fileId));
  if (missingAltLanguages(existing, languages, file.fingerprint).length === 0) {
    await setAltState(db, fileId, "completed");

    return { written: [] };
  }

  const image = await prepareImage(c, file);
  if (!image) {
    await setAltState(
      db,
      fileId,
      "skipped",
      "The file could not be read or is too large",
    );

    return { written: [] };
  }
  if (file.fingerprint !== image.fingerprint) {
    // An older file, or one whose bytes changed: its AI texts no longer match.
    await db
      .update(core_files)
      .set({ fingerprint: image.fingerprint })
      .where(eq(core_files.id, fileId));
  }
  const fingerprint = image.fingerprint;
  const missing = missingAltLanguages(existing, languages, fingerprint);

  let [analysis] = await db
    .select()
    .from(core_files_alt_analysis)
    .where(
      and(
        eq(core_files_alt_analysis.fileId, fileId),
        eq(core_files_alt_analysis.fileFingerprint, fingerprint),
      ),
    );

  try {
    if (!analysis) {
      // Another worker may still be describing this exact version (a lease
      // that has not expired). Wait for it instead of paying twice. A run
      // that died is settled by maintenance; after that, one new call is the
      // price of a crash - exactly-once is not promised.
      const [inFlight] = await db
        .select({ id: core_ai_runs.id })
        .from(core_ai_runs)
        .where(
          and(
            eq(core_ai_runs.actionKey, ALT_GENERATE_AI_ACTION),
            eq(core_ai_runs.resourceId, String(fileId)),
            eq(core_ai_runs.sourceFingerprint, fingerprint),
            eq(core_ai_runs.settlement, "pending"),
            gt(core_ai_runs.leaseExpiresAt, new Date()),
          ),
        )
        .limit(1);
      if (inFlight) {
        throw new QueueDeferError(
          new Date(Date.now() + 5 * 60_000),
          "The image is already being described",
        );
      }

      const result = await c.get("ai").runAsSystem({
        action: ALT_GENERATE_AI_ACTION,
        input: { image: image.bytes, mediaType: image.mediaType },
        resource: { id: fileId, type: "core.file" },
        sourceFingerprint: fingerprint,
      });
      [analysis] = await db
        .insert(core_files_alt_analysis)
        .values({
          description: result.output,
          fileFingerprint: fingerprint,
          fileId,
          runId: result.runId,
        })
        .onConflictDoUpdate({
          set: { description: result.output, runId: result.runId },
          target: [
            core_files_alt_analysis.fileId,
            core_files_alt_analysis.fileFingerprint,
          ],
        })
        .returning();
    }

    const written: string[] = [];
    for (const languageCode of missing) {
      let text = analysis.description;
      let runId = analysis.runId;
      if (languageCode !== ALT_BASE_LANGUAGE) {
        const translated = await c.get("ai").runAsSystem({
          action: ALT_TRANSLATE_AI_ACTION,
          input: { text: analysis.description, to: languageCode },
          resource: { id: fileId, type: "core.file" },
          sourceFingerprint: fingerprint,
        });
        text = translated.output;
        runId = translated.runId;
      }
      if (
        await writeAiAlt(db, { fileId, fingerprint, languageCode, runId, text })
      ) {
        written.push(languageCode);
        // Per language, as it lands: a later failure must not hide it.
        await c
          .get("events")
          ?.emit("files.alt.updated", {
            fileId,
            languageCodes: [languageCode],
            origin: "ai",
          })
          .catch(() => undefined);
      }
    }

    await setAltState(db, fileId, "completed");

    return { written };
  } catch (error) {
    if (isAiError(error) && BUDGET_CODES.has(error.code)) {
      return await deferForBudget(db, fileId, settings);
    }
    if (error instanceof QueueDeferError) throw error;
    // Configuration problems no retry can fix: record them and stop, instead
    // of spending the queue's attempts. An admin fixes the setup; the sweep
    // picks the file up again after its back-off.
    if (isAiError(error) && CONFIG_CODES.has(error.code)) {
      await setAltState(db, fileId, "failed", error.code);

      return { written: [] };
    }
    const message = isAiError(error) ? error.code : "ALT generation failed";
    await setAltState(db, fileId, "failed", message);
    throw error;
  }
};
