import type { Context } from "hono";

import { and, desc, eq, inArray } from "drizzle-orm";
import { createTranslator } from "use-intl";

import type { AccountDeletionSource } from "@/database/account-deletions";
import type { EnvVitNode } from "@/middlewares/global.middleware";

import { core_users_deletions } from "@/database/account-deletions";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import AccountDeletionScheduledEmailTemplate from "@/emails/account-deletion-scheduled";
import {
  userDeletionCancelledEvent,
  userDeletionRequestedEvent,
} from "@/events/users";
import { PG_ERROR_CODES, pgErrorCode } from "@/lib/api/pg-error";
import { getUserRoleIds } from "@/lib/check-staff-permission";
import { CONFIG } from "@/lib/config";
import { revokeSessions } from "@/models/session-revoke";

const DAY_MS = 86_400_000;

/** The settings page a member cancels a pending deletion from. */
export const PRIVACY_SETTINGS_PATH = "settings/privacy";

/** Requests that still hold an account: waiting for erasure, or erasure failed. */
export const OPEN_ACCOUNT_DELETION_STATUSES = ["pending", "failed"] as const;

export interface OpenAccountDeletion {
  attempts: number;
  createdAt: Date;
  id: number;
  lastError: null | string;
  scheduledAt: Date;
  source: AccountDeletionSource;
  status: (typeof OPEN_ACCOUNT_DELETION_STATUSES)[number];
}

/**
 * The member's open deletion request, if any: pending, or failed and waiting
 * for staff to retry it. Either way the account is on its way out.
 */
export const findOpenAccountDeletion = async (
  c: Context<EnvVitNode>,
  userId: number,
): Promise<null | OpenAccountDeletion> => {
  const [row] = await c
    .get("db")
    .select({
      attempts: core_users_deletions.attempts,
      createdAt: core_users_deletions.createdAt,
      id: core_users_deletions.id,
      lastError: core_users_deletions.lastError,
      scheduledAt: core_users_deletions.scheduledAt,
      source: core_users_deletions.source,
      status: core_users_deletions.status,
    })
    .from(core_users_deletions)
    .where(
      and(
        eq(core_users_deletions.userId, userId),
        inArray(core_users_deletions.status, OPEN_ACCOUNT_DELETION_STATUSES),
      ),
    )
    .orderBy(desc(core_users_deletions.createdAt))
    .limit(1);

  if (!row || (row.status !== "pending" && row.status !== "failed")) {
    return null;
  }

  return { ...row, status: row.status };
};

/**
 * Opens a deletion request for `userId`, due after the grace period (or now,
 * with `immediately`). Returns the request already pending, unchanged, when
 * there is one.
 */
export const openAccountDeletion = async (
  c: Context<EnvVitNode>,
  {
    immediately = false,
    requestedById,
    source,
    userId,
  }: {
    immediately?: boolean;
    requestedById: null | number;
    source: AccountDeletionSource;
    userId: number;
  },
): Promise<{ created: boolean; deletion: OpenAccountDeletion }> => {
  const existing = await findOpenAccountDeletion(c, userId);
  if (existing) return { created: false, deletion: existing };

  const graceDays = immediately ? 0 : c.get("core").privacy.deletionGraceDays;
  const scheduledAt = new Date(Date.now() + graceDays * DAY_MS);

  try {
    const [deletion] = await c
      .get("db")
      .insert(core_users_deletions)
      .values({
        erasedUserId: userId,
        requestedById,
        scheduledAt,
        source,
        userId,
      })
      .returning({
        attempts: core_users_deletions.attempts,
        createdAt: core_users_deletions.createdAt,
        id: core_users_deletions.id,
        lastError: core_users_deletions.lastError,
        scheduledAt: core_users_deletions.scheduledAt,
        source: core_users_deletions.source,
      });

    return { created: true, deletion: { ...deletion, status: "pending" } };
  } catch (error) {
    // Two requests raced; the partial unique index let one through.
    if (pgErrorCode(error) !== PG_ERROR_CODES.uniqueViolation) throw error;
    const raced = await findOpenAccountDeletion(c, userId);
    if (!raced) throw error;

    return { created: false, deletion: raced };
  }
};

/**
 * Schedules a member's own (or an admin's) deletion request with a grace
 * period: signs the account out everywhere, emails how to cancel and emits
 * `user.deletion.requested`.
 */
export const scheduleAccountDeletion = async (
  c: Context<EnvVitNode>,
  args: {
    requestedById: null | number;
    source: AccountDeletionSource;
    userId: number;
  },
): Promise<OpenAccountDeletion> => {
  const { created, deletion } = await openAccountDeletion(c, args);
  if (!created) return deletion;

  await revokeSessions(c, { userId: args.userId });

  const [user] = await c
    .get("db")
    .select({
      email: core_users.email,
      language: core_users.language,
      name: core_users.name,
      nameCode: core_users.nameCode,
    })
    .from(core_users)
    .where(eq(core_users.id, args.userId))
    .limit(1);

  if (user && c.get("core").email?.adapter) {
    try {
      await c.get("email").send({
        user: { ...user, id: args.userId },
        content: props =>
          AccountDeletionScheduledEmailTemplate({
            ...props,
            byAdmin: args.source === "admin",
            cancelUrl: new URL(PRIVACY_SETTINGS_PATH, CONFIG.web.href).href,
            name: user.name,
            scheduledAt: deletion.scheduledAt,
          }),
        subject: ({ i18n }) =>
          createTranslator(i18n)(
            "core.auth.account_deletion.email.scheduled.subject",
          ),
      });
    } catch (error) {
      await c
        .get("log")
        .warn(
          `Account deletion: the confirmation email could not be queued. ${error instanceof Error ? error.message : String(error)}`,
        );
    }
  }

  await c.get("events").emit(userDeletionRequestedEvent, {
    scheduledAt: deletion.scheduledAt.toISOString(),
    source: args.source,
    userId: args.userId,
  });

  return deletion;
};

/**
 * Cancels the member's open deletion request, pending or failed. Returns
 * `false` when there was none to cancel.
 */
export const cancelAccountDeletion = async (
  c: Context<EnvVitNode>,
  userId: number,
): Promise<boolean> => {
  const rows = await c
    .get("db")
    .update(core_users_deletions)
    .set({ cancelledAt: new Date(), status: "cancelled" })
    .where(
      and(
        eq(core_users_deletions.userId, userId),
        inArray(core_users_deletions.status, OPEN_ACCOUNT_DELETION_STATUSES),
      ),
    )
    .returning({ id: core_users_deletions.id });

  if (rows.length === 0) return false;

  await c.get("events").emit(userDeletionCancelledEvent, { userId });

  return true;
};

/**
 * Whether the member's roles let them delete their own account: every role
 * they hold (primary and secondary) must have `allowDeleteAccount`. Staff can
 * still delete the account from the AdminCP.
 */
export const canDeleteOwnAccount = async (
  c: Context<EnvVitNode>,
  user: { id: number; roleId: number },
): Promise<boolean> => {
  const roleIds = await getUserRoleIds(c, user);
  const roles = await c
    .get("db")
    .select({ allowDeleteAccount: core_roles.allowDeleteAccount })
    .from(core_roles)
    .where(inArray(core_roles.id, roleIds));

  return roles.length > 0 && roles.every(role => role.allowDeleteAccount);
};
