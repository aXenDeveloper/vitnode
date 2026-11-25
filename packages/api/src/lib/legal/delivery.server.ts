import type { Context } from "hono";

import { and, asc, count, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { createElement } from "react";
import { createTranslator } from "use-intl";

import { core_users_deletions } from "@/database/account-deletions";
import {
  core_legal_deliveries,
  core_legal_fanouts,
  core_legal_versions,
  type LegalDeliverySkipReason,
} from "@/database/legal";
import { core_queue } from "@/database/queue";
import { core_users } from "@/database/users";
import LegalUpdateEmailTemplate from "@/emails/legal-update";
import { manifest } from "@/manifest";

import type { EnvVitNode } from "../../middlewares/global.middleware";

import { getQueueBackoffDate } from "../api/get-queue-backoff-date";
import { CONFIG } from "../config";
import { sanitizeDeliveryError } from "../notifications/safe";
import {
  legalComparePath,
  legalVersionPath,
  localizeLegalContent,
} from "./contract";

/** Members added to the delivery list per transaction. */
export const LEGAL_FANOUT_BATCH = 500;
/** Emails claimed per send batch. */
export const LEGAL_SEND_BATCH = 25;
/** Provider attempts per recipient before the delivery is `failed`. */
export const LEGAL_DELIVERY_MAX_ATTEMPTS = 5;
/**
 * Consecutive provider failures that count as an outage. A smaller batch in
 * which every attempted send failed counts too.
 */
export const LEGAL_INCIDENT_THRESHOLD = 5;
/** How long to wait before trying again after an outage. */
const INCIDENT_PAUSE_MS = 5 * 60 * 1000;
/** A `sending` row older than this was abandoned by a crashed worker. */
const STALE_SENDING_MS = 15 * 60 * 1000;
/** Work budget of one queue run. */
const RUN_BUDGET_MS = 20_000;

type VersionRow = typeof core_legal_versions.$inferSelect;

export interface LegalRecipient {
  email: string;
  emailVerified: boolean;
  id: number;
  pendingDeletion: boolean;
}

/**
 * Why a member cannot receive the announcement, or `null` when they can: no
 * usable address, an unverified address, or an account being deleted.
 * Checked when the list is built and again right before each send. Pure.
 */
export const legalSkipReasonOf = (
  recipient: LegalRecipient,
): LegalDeliverySkipReason | null => {
  const email = recipient.email.trim();
  if (email === "" || !email.includes("@")) return "no_address";
  if (!recipient.emailVerified) return "unverified";
  if (recipient.pendingDeletion) return "deleted";

  return null;
};

/** Members of `userIds` with an open account-deletion request. */
const pendingDeletionsOf = async (
  db: Context["var"]["db"],
  userIds: readonly number[],
): Promise<number[]> => {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ userId: core_users_deletions.userId })
    .from(core_users_deletions)
    .where(
      and(
        inArray(core_users_deletions.userId, [...userIds]),
        eq(core_users_deletions.status, "pending"),
      ),
    );

  return rows.flatMap(row => (row.userId === null ? [] : [row.userId]));
};

const absoluteUrl = (path: string): string => {
  const base = CONFIG.web.href.endsWith("/")
    ? CONFIG.web.href
    : `${CONFIG.web.href}/`;

  return new URL(path.replace(/^\//, ""), base).toString();
};

/** The stable public links an announcement carries. */
export const legalEmailLinks = (
  version: Pick<VersionRow, "documentType" | "version">,
): { compareUrl: null | string; fullTextUrl: string } => ({
  compareUrl:
    version.version > 1
      ? absoluteUrl(legalComparePath(version.documentType, version.version))
      : null,
  fullTextUrl: absoluteUrl(
    legalVersionPath(version.documentType, version.version),
  ),
});

/**
 * Renders the announcement of `version` for one recipient, in their language
 * (falling back as the public page does). Used by the sender and by the
 * AdminCP preview, so staff see exactly what members get. Server-only.
 */
export const buildLegalUpdateEmail = async (
  c: Context,
  version: Pick<
    VersionRow,
    | "acceptanceLabel"
    | "body"
    | "defaultLanguageCode"
    | "documentType"
    | "effectiveAt"
    | "requiresAcceptance"
    | "summary"
    | "title"
    | "version"
  >,
  recipient: { email: string; language: string },
) => {
  const i18n = c.get("i18n");
  const locale = i18n.resolveSupportedLocale(recipient.language);
  const snapshot = localizeLegalContent(
    version,
    locale,
    version.defaultLanguageCode,
  );
  const links = legalEmailLinks(version);

  return await c.get("email").build({
    content: props =>
      createElement(LegalUpdateEmailTemplate, {
        ...props,
        ...links,
        documentType: version.documentType,
        effectiveAt: version.effectiveAt,
        requiresAcceptance: version.requiresAcceptance,
        summary: snapshot.summary,
        title: snapshot.title,
        version: version.version,
      }),
    locale,
    subject: ({ i18n: email }) =>
      createTranslator(email)("core.legal.email.subject", {
        title: snapshot.title,
        version: version.version,
      }),
    to: recipient.email,
  });
};

/** The provider idempotency key of one announcement email. */
export const legalDeliveryKey = (versionId: number, userId: number): string =>
  `vitnode-legal-${versionId}-${userId}`;

const hasActiveTask = async (
  c: Context,
  name: string,
  versionId: number,
): Promise<boolean> => {
  const [row] = await c
    .get("db")
    .select({ id: core_queue.id })
    .from(core_queue)
    .where(
      and(
        eq(core_queue.pluginId, manifest.id),
        eq(core_queue.name, name),
        inArray(core_queue.status, ["pending", "processing"]),
        sql`${core_queue.payload}->>'versionId' = ${String(versionId)}`,
      ),
    )
    .limit(2);

  return row !== undefined;
};

/**
 * Adds the next batches of recipients to a version's delivery list, resuming
 * from the stored cursor. One row per member and version (the unique key
 * makes a rerun a no-op), `skipped` with a reason when the member cannot be
 * emailed. Returns whether the list is complete. Server-only.
 */
export const runLegalFanout = async (
  c: Context,
  versionId: number,
): Promise<{ completed: boolean }> => {
  const db = c.get("db");
  const started = Date.now();

  while (Date.now() - started < RUN_BUDGET_MS) {
    const [fanout] = await db
      .select()
      .from(core_legal_fanouts)
      .where(eq(core_legal_fanouts.versionId, versionId))
      .limit(1);
    if (!fanout) return { completed: true };
    if (fanout.status === "completed") return { completed: true };

    const users = await db
      .select({
        email: core_users.email,
        emailVerified: core_users.emailVerified,
        id: core_users.id,
      })
      .from(core_users)
      .where(
        and(
          gt(core_users.id, fanout.cursorUserId),
          lte(core_users.createdAt, fanout.recipientsCreatedBefore),
        ),
      )
      .orderBy(asc(core_users.id))
      .limit(LEGAL_FANOUT_BATCH);

    const deleting = new Set(
      await pendingDeletionsOf(
        db,
        users.map(user => user.id),
      ),
    );
    const done = users.length < LEGAL_FANOUT_BATCH;
    const last = users.at(-1)?.id ?? fanout.cursorUserId;

    await db.transaction(async tx => {
      if (users.length > 0) {
        await tx
          .insert(core_legal_deliveries)
          .values(
            users.map(user => {
              const skipReason = legalSkipReasonOf({
                ...user,
                pendingDeletion: deleting.has(user.id),
              });

              return {
                skipReason,
                status: skipReason
                  ? ("skipped" as const)
                  : ("pending" as const),
                userId: user.id,
                versionId,
              };
            }),
          )
          .onConflictDoNothing();
      }
      await tx
        .update(core_legal_fanouts)
        .set({
          completedAt: done ? new Date() : null,
          cursorUserId: last,
          status: done ? "completed" : "running",
        })
        .where(eq(core_legal_fanouts.versionId, versionId));
    });

    if (done) return { completed: true };
  }

  return { completed: false };
};

const claimDeliveries = async (c: Context, versionId: number) =>
  await c.get("db").execute<{
    attempts: number;
    id: number;
    userId: number;
  }>(sql`
    update ${core_legal_deliveries}
    set "status" = 'sending', "attempts" = "attempts" + 1,
        "lastAttemptAt" = now(), "updatedAt" = now()
    where "id" in (
      select "id" from ${core_legal_deliveries}
      where "versionId" = ${versionId} and "status" = 'pending'
        and "nextAttemptAt" <= now()
      order by "id"
      limit ${LEGAL_SEND_BATCH}
      for update skip locked
    )
    returning "id", "userId", "attempts"
  `);

const rowsOf = <T>(result: unknown): T[] =>
  Array.isArray(result)
    ? (result as T[])
    : ((result as { rows?: T[] }).rows ?? []);

/**
 * Sends due announcement emails of one version in bounded batches, through
 * the configured adapter with a per-recipient idempotency key. Rechecks each
 * address right before sending. A transient error schedules a retry with
 * backoff; after {@link LEGAL_DELIVERY_MAX_ATTEMPTS} the delivery is `failed`.
 * {@link LEGAL_INCIDENT_THRESHOLD} failures in a row (or a batch where every
 * attempted send failed) with no success mark a
 * provider incident on the fan-out and pause it. Returns when the next run
 * should happen, or `null` when nothing is left. Server-only.
 */
export const runLegalSend = async (
  c: Context,
  versionId: number,
): Promise<{ nextRunAt: Date | null }> => {
  const db = c.get("db");
  const started = Date.now();

  await db
    .update(core_legal_deliveries)
    .set({ status: "pending" })
    .where(
      and(
        eq(core_legal_deliveries.versionId, versionId),
        eq(core_legal_deliveries.status, "sending"),
        lte(
          core_legal_deliveries.lastAttemptAt,
          new Date(Date.now() - STALE_SENDING_MS),
        ),
      ),
    );

  const [version] = await db
    .select()
    .from(core_legal_versions)
    .where(eq(core_legal_versions.id, versionId))
    .limit(1);
  if (!version) return { nextRunAt: null };

  if (!c.get("core").email?.adapter) {
    await db
      .update(core_legal_fanouts)
      .set({
        incidentAt: sql`coalesce(${core_legal_fanouts.incidentAt}, now())`,
        lastError: "No email adapter is configured.",
      })
      .where(eq(core_legal_fanouts.versionId, versionId));

    return { nextRunAt: new Date(Date.now() + INCIDENT_PAUSE_MS) };
  }

  let consecutiveFailures = 0;

  while (Date.now() - started < RUN_BUDGET_MS) {
    const claimed = rowsOf<{ attempts: number; id: number; userId: number }>(
      await claimDeliveries(c, versionId),
    );
    if (claimed.length === 0) break;

    const users = await db
      .select({
        email: core_users.email,
        emailVerified: core_users.emailVerified,
        id: core_users.id,
        language: core_users.language,
      })
      .from(core_users)
      .where(
        inArray(
          core_users.id,
          claimed.map(row => row.userId),
        ),
      );
    const byId = new Map(users.map(user => [user.id, user]));
    const deleting = new Set(
      await pendingDeletionsOf(
        db,
        claimed.map(row => row.userId),
      ),
    );
    let batchSucceeded = false;
    let attempted = 0;

    for (const delivery of claimed) {
      const user = byId.get(delivery.userId);
      const skipReason = user
        ? legalSkipReasonOf({ ...user, pendingDeletion: deleting.has(user.id) })
        : "deleted";

      if (!user || skipReason) {
        await db
          .update(core_legal_deliveries)
          .set({ lastError: null, skipReason, status: "skipped" })
          .where(eq(core_legal_deliveries.id, delivery.id));
        continue;
      }

      attempted++;
      try {
        const email = await buildLegalUpdateEmail(c, version, user);
        const result = await c.get("email").deliver(email, {
          idempotencyKey: legalDeliveryKey(versionId, user.id),
        });
        await db
          .update(core_legal_deliveries)
          .set({
            lastError: null,
            providerMessageId: result.id?.slice(0, 255) ?? null,
            sentAt: new Date(),
            status: "sent",
          })
          .where(eq(core_legal_deliveries.id, delivery.id));
        consecutiveFailures = 0;
        batchSucceeded = true;
      } catch (error) {
        consecutiveFailures++;
        const exhausted = delivery.attempts >= LEGAL_DELIVERY_MAX_ATTEMPTS;
        await db
          .update(core_legal_deliveries)
          .set({
            lastError: sanitizeDeliveryError(error),
            nextAttemptAt: getQueueBackoffDate(delivery.attempts),
            status: exhausted ? "failed" : "pending",
          })
          .where(eq(core_legal_deliveries.id, delivery.id));
      }
    }

    if (batchSucceeded) {
      await db
        .update(core_legal_fanouts)
        .set({ incidentAt: null, lastError: null })
        .where(eq(core_legal_fanouts.versionId, versionId));
    } else if (
      attempted > 0 &&
      consecutiveFailures >= Math.min(LEGAL_INCIDENT_THRESHOLD, attempted)
    ) {
      const [lastFailure] = await db
        .select({ lastError: core_legal_deliveries.lastError })
        .from(core_legal_deliveries)
        .where(
          and(
            eq(core_legal_deliveries.versionId, versionId),
            sql`${core_legal_deliveries.lastError} is not null`,
          ),
        )
        .orderBy(sql`${core_legal_deliveries.updatedAt} desc`)
        .limit(1);
      await db
        .update(core_legal_fanouts)
        .set({
          incidentAt: sql`coalesce(${core_legal_fanouts.incidentAt}, now())`,
          lastError: lastFailure?.lastError ?? "Email provider errors",
        })
        .where(eq(core_legal_fanouts.versionId, versionId));

      return { nextRunAt: new Date(Date.now() + INCIDENT_PAUSE_MS) };
    }
  }

  const [next] = await db
    .select({
      at: sql<null | string>`min(${core_legal_deliveries.nextAttemptAt})`,
    })
    .from(core_legal_deliveries)
    .where(
      and(
        eq(core_legal_deliveries.versionId, versionId),
        inArray(core_legal_deliveries.status, ["pending", "sending"]),
      ),
    );
  if (!next?.at) return { nextRunAt: null };
  const at = new Date(next.at);

  return { nextRunAt: at.getTime() < Date.now() ? new Date() : at };
};

/**
 * Queues the send task of a version unless one is already waiting, so a
 * chain of retries never multiplies. `force` queues a new run now even when
 * one is waiting (a manual retry). Server-only.
 */
export const scheduleLegalSend = async (
  c: Context<EnvVitNode>,
  versionId: number,
  availableAt: Date = new Date(),
  { force = false }: { force?: boolean } = {},
): Promise<void> => {
  const { legalSendTask } = await import("./delivery-tasks");
  if (!force && (await hasActiveTask(c, legalSendTask.name, versionId))) return;

  await c
    .get("queue")
    .dispatch(legalSendTask, { versionId }, { availableAt, priority: 5 });
};

/** Queues the fan-out task of a version unless one is already waiting. */
export const scheduleLegalFanout = async (
  c: Context<EnvVitNode>,
  versionId: number,
): Promise<void> => {
  const { legalFanoutTask } = await import("./delivery-tasks");
  if (await hasActiveTask(c, legalFanoutTask.name, versionId)) return;

  await c
    .get("queue")
    .dispatch(legalFanoutTask, { versionId }, { priority: 5 });
};

/**
 * Puts failed deliveries of a version back in line with a fresh attempt
 * budget, then queues a send run now. `deliveryIds` limits it to those rows;
 * omit it to retry every failed one. Returns how many were reset. Server-only.
 */
export const retryLegalDeliveries = async (
  c: Context<EnvVitNode>,
  versionId: number,
  deliveryIds?: readonly number[],
): Promise<number> => {
  const reset = await c
    .get("db")
    .update(core_legal_deliveries)
    .set({
      attempts: 0,
      lastError: null,
      nextAttemptAt: new Date(),
      status: "pending",
    })
    .where(
      and(
        eq(core_legal_deliveries.versionId, versionId),
        eq(core_legal_deliveries.status, "failed"),
        deliveryIds && deliveryIds.length > 0
          ? inArray(core_legal_deliveries.id, [...deliveryIds])
          : undefined,
      ),
    )
    .returning({ id: core_legal_deliveries.id });

  if (reset.length > 0) {
    await c
      .get("db")
      .update(core_legal_fanouts)
      .set({ incidentAt: null, lastError: null })
      .where(eq(core_legal_fanouts.versionId, versionId));
    await scheduleLegalSend(c, versionId, new Date(), { force: true });
  }

  return reset.length;
};

/** Delivery counts of one version, by status and skip reason. */
export interface LegalDeliveryStats {
  failed: number;
  pending: number;
  sent: number;
  skipped: { deleted: number; no_address: number; unverified: number };
  total: number;
}

/** Counts a version's deliveries. Server-only. */
export const legalDeliveryStats = async (
  c: Context,
  versionIds: readonly number[],
): Promise<Map<number, LegalDeliveryStats>> => {
  const stats = new Map<number, LegalDeliveryStats>();
  if (versionIds.length === 0) return stats;

  const rows = await c
    .get("db")
    .select({
      count: count(),
      skipReason: core_legal_deliveries.skipReason,
      status: core_legal_deliveries.status,
      versionId: core_legal_deliveries.versionId,
    })
    .from(core_legal_deliveries)
    .where(inArray(core_legal_deliveries.versionId, [...versionIds]))
    .groupBy(
      core_legal_deliveries.versionId,
      core_legal_deliveries.status,
      core_legal_deliveries.skipReason,
    );

  for (const id of versionIds) {
    stats.set(id, {
      failed: 0,
      pending: 0,
      sent: 0,
      skipped: { deleted: 0, no_address: 0, unverified: 0 },
      total: 0,
    });
  }
  for (const row of rows) {
    const entry = stats.get(row.versionId);
    if (!entry) continue;
    entry.total += row.count;
    if (row.status === "skipped") {
      entry.skipped[row.skipReason ?? "no_address"] += row.count;
    } else if (row.status === "sending" || row.status === "pending") {
      entry.pending += row.count;
    } else {
      entry[row.status] += row.count;
    }
  }

  return stats;
};
