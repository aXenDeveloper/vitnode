import type { Context } from "hono";

import { and, asc, eq, lte, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { createTranslator } from "use-intl";

import type { EnvVitNode } from "@/middlewares/global.middleware";

import { core_users_deletions } from "@/database/account-deletions";
import { core_files } from "@/database/files";
import { core_sessions_known_devices } from "@/database/sessions";
import { core_users } from "@/database/users";
import AccountDeletedEmailTemplate from "@/emails/account-deleted";
import { userDeletedEvent } from "@/events/users";
import { isPgReferenceViolation, pgConstraintName } from "@/lib/api/pg-error";
import { writeAuditLog } from "@/lib/audit/write";
import { revokeSessions } from "@/models/session-revoke";
import { isOrphanedDevice } from "@/modules/cron/cron/clean.cron";

/** Failed erasures are retried by the hourly job this many times, then left for an admin. */
export const ACCOUNT_DELETION_MAX_ATTEMPTS = 5;

/** Erasures one cron run handles, so a backlog spreads over several runs. */
const ACCOUNT_DELETION_BATCH_SIZE = 20;

export type EraseAccountResult =
  | {
      /** Also stored on the request as `lastError`. */
      error: string;
      filesDeleted: number;
      filesKept: number;
      status: "failed";
    }
  | {
      filesDeleted: number;
      filesKept: number;
      status: "completed" | "not_found";
    };

const describeError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  if (!isPgReferenceViolation(error)) return message;

  const constraint = pgConstraintName(error);

  return `Another table still requires this account${constraint ? ` (${constraint})` : ""}. The plugin that owns it must delete or reassign those rows in its \`personalData.erase\`.`;
};

/**
 * Deletes every stored file the member uploaded. A file live content still
 * shows is kept - the content stays, attributed to nobody - and counted.
 */
const deleteUserFiles = async (
  c: Context<EnvVitNode>,
  userId: number,
): Promise<{ deleted: number; kept: number }> => {
  const files = await c
    .get("db")
    .select({ id: core_files.id })
    .from(core_files)
    .where(eq(core_files.userId, userId));

  let deleted = 0;
  let kept = 0;
  for (const file of files) {
    try {
      await c
        .get("storage")
        .deleteFile(file.id, { force: true, ownerId: userId });
      deleted++;
    } catch (error) {
      if (error instanceof HTTPException && error.status === 409) {
        kept++;
        continue;
      }
      if (error instanceof HTTPException && error.status === 404) continue;
      throw error;
    }
  }

  return { deleted, kept };
};

const sendAccountDeletedEmail = async (
  c: Context<EnvVitNode>,
  { email, language, name }: { email: string; language: string; name: string },
) => {
  if (!c.get("core").email?.adapter) return;

  try {
    await c.get("email").send({
      to: email,
      locale: language,
      content: props => AccountDeletedEmailTemplate({ ...props, name }),
      subject: ({ i18n }) =>
        createTranslator(i18n)(
          "core.auth.account_deletion.email.deleted.subject",
        ),
    });
  } catch (error) {
    await c
      .get("log")
      .warn(
        `Account deletion: the confirmation email could not be queued. ${describeError(error)}`,
      );
  }
};

/**
 * Erases one account now: signs it out everywhere, deletes its files, runs
 * every plugin's `personalData.erase` and deletes the `core_users` row in one
 * transaction, then emits `user.deleted` and emails a confirmation.
 *
 * Idempotent: an account that no longer exists is `not_found`. A failure
 * leaves the account in place, records the error on the open request and
 * returns `failed` - the hourly job retries it.
 *
 * Server-only.
 */
export const eraseAccount = async (
  c: Context<EnvVitNode>,
  { deletionId, userId }: { deletionId: number; userId: number },
): Promise<EraseAccountResult> => {
  const db = c.get("db");

  const [user] = await db
    .select({
      email: core_users.email,
      language: core_users.language,
      name: core_users.name,
    })
    .from(core_users)
    .where(eq(core_users.id, userId))
    .limit(1);

  if (!user) {
    await db
      .update(core_users_deletions)
      .set({ completedAt: new Date(), status: "completed" })
      .where(eq(core_users_deletions.id, deletionId));

    return { filesDeleted: 0, filesKept: 0, status: "not_found" };
  }

  let files = { deleted: 0, kept: 0 };
  try {
    await revokeSessions(c, { userId });
    files = await deleteUserFiles(c, userId);

    await db.transaction(async tx => {
      for (const entry of c.get("core").personalData) {
        await entry.erase?.({ c, tx, userId });
      }

      await tx
        .update(core_users_deletions)
        .set({
          completedAt: new Date(),
          filesDeleted: sql`${core_users_deletions.filesDeleted} + ${files.deleted}`,
          filesKept: sql`${core_users_deletions.filesKept} + ${files.kept}`,
          lastError: null,
          status: "completed",
        })
        .where(eq(core_users_deletions.id, deletionId));

      await tx.delete(core_users).where(eq(core_users.id, userId));

      await writeAuditLog(
        c,
        {
          action: "user.deleted",
          metadata: { deletionId, filesKept: files.kept },
          target: { id: userId, label: `#${userId}`, type: "user" },
        },
        tx,
      );
    });
  } catch (error) {
    const reason = describeError(error);
    const [row] = await db
      .update(core_users_deletions)
      .set({
        attempts: sql`${core_users_deletions.attempts} + 1`,
        filesDeleted: sql`${core_users_deletions.filesDeleted} + ${files.deleted}`,
        filesKept: sql`${core_users_deletions.filesKept} + ${files.kept}`,
        lastError: reason.slice(0, 2000),
      })
      .where(eq(core_users_deletions.id, deletionId))
      .returning({ attempts: core_users_deletions.attempts });

    if (row && row.attempts >= ACCOUNT_DELETION_MAX_ATTEMPTS) {
      await db
        .update(core_users_deletions)
        .set({ status: "failed" })
        .where(eq(core_users_deletions.id, deletionId));
    }

    await c
      .get("log")
      .error(`Account deletion #${deletionId} failed: ${reason}`);

    return {
      error: reason,
      filesDeleted: files.deleted,
      filesKept: files.kept,
      status: "failed",
    };
  }

  await db
    .delete(core_sessions_known_devices)
    .where(isOrphanedDevice(db))
    .catch(async (error: unknown) => {
      await c
        .get("log")
        .warn(
          `Account deletion #${deletionId}: orphaned devices were not removed. ${describeError(error)}`,
        );
    });
  await c.get("events").emit(userDeletedEvent, { email: user.email, userId });
  await sendAccountDeletedEmail(c, user);

  return {
    filesDeleted: files.deleted,
    filesKept: files.kept,
    status: "completed",
  };
};

/**
 * Erases every account whose grace period is over, oldest first. Called by
 * the hourly `account-deletion` cron job.
 */
export const processDueAccountDeletions = async (
  c: Context<EnvVitNode>,
  now = new Date(),
): Promise<number> => {
  const due = await c
    .get("db")
    .select({
      id: core_users_deletions.id,
      userId: core_users_deletions.userId,
    })
    .from(core_users_deletions)
    .where(
      and(
        eq(core_users_deletions.status, "pending"),
        lte(core_users_deletions.scheduledAt, now),
      ),
    )
    .orderBy(asc(core_users_deletions.scheduledAt))
    .limit(ACCOUNT_DELETION_BATCH_SIZE);

  let erased = 0;
  for (const deletion of due) {
    if (deletion.userId === null) {
      await c
        .get("db")
        .update(core_users_deletions)
        .set({ completedAt: now, status: "completed" })
        .where(eq(core_users_deletions.id, deletion.id));
      continue;
    }

    const result = await eraseAccount(c, {
      deletionId: deletion.id,
      userId: deletion.userId,
    });
    if (result.status === "completed") erased++;
  }

  return erased;
};
