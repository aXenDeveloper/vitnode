import { and, eq } from "drizzle-orm";

import { core_users_deletions } from "@/database/account-deletions";
import { core_audit_logs } from "@/database/audit";
import { core_files } from "@/database/files";
import { core_logs } from "@/database/logs";
import { core_moderation_reports } from "@/database/moderation";
import { core_users_passkeys } from "@/database/passkeys";
import { core_payments } from "@/database/payments";
import {
  core_sessions,
  core_sessions_known_devices,
} from "@/database/sessions";
import {
  core_users,
  core_users_secondary_roles,
  core_users_sso,
} from "@/database/users";
import {
  core_moderation_sanctions,
  core_moderation_warnings,
} from "@/database/warnings";
import { eraseChatData, exportChatData } from "@/lib/chat/personal-data";
import { manifest } from "@/manifest";

import { definePersonalData } from "../personal-data";

const iso = (date: Date | null) => date?.toISOString() ?? null;

/**
 * Core's own tables. Rows that cascade with `core_users` need nothing here;
 * these are the ones that outlive the account and still say who it was.
 */
export const corePersonalData = definePersonalData({
  export: async ({ c, userId }) => {
    const db = c.get("db");

    const [
      [profile],
      secondaryRoles,
      devices,
      passkeys,
      sso,
      files,
      payments,
      warnings,
      sanctions,
      reports,
      deletions,
    ] = await Promise.all([
      db
        .select({
          id: core_users.id,
          name: core_users.name,
          nameCode: core_users.nameCode,
          email: core_users.email,
          emailVerified: core_users.emailVerified,
          firstName: core_users.firstName,
          lastName: core_users.lastName,
          phone: core_users.phone,
          headline: core_users.headline,
          birthday: core_users.birthday,
          showRealName: core_users.showRealName,
          language: core_users.language,
          timeZone: core_users.timeZone,
          newsletter: core_users.newsletter,
          hideOnlineStatus: core_users.hideOnlineStatus,
          ipAddress: core_users.ipAddress,
          createdAt: core_users.createdAt,
          lastSeenAt: core_users.lastSeenAt,
          roleId: core_users.roleId,
        })
        .from(core_users)
        .where(eq(core_users.id, userId))
        .limit(1),
      db
        .select({
          roleId: core_users_secondary_roles.roleId,
          since: core_users_secondary_roles.createdAt,
        })
        .from(core_users_secondary_roles)
        .where(eq(core_users_secondary_roles.userId, userId)),
      db
        .selectDistinct({
          ipAddress: core_sessions_known_devices.ipAddress,
          userAgent: core_sessions_known_devices.userAgent,
          lastSeen: core_sessions_known_devices.lastSeen,
        })
        .from(core_sessions)
        .innerJoin(
          core_sessions_known_devices,
          eq(core_sessions_known_devices.id, core_sessions.deviceId),
        )
        .where(eq(core_sessions.userId, userId)),
      db
        .select({
          name: core_users_passkeys.name,
          deviceType: core_users_passkeys.deviceType,
          createdAt: core_users_passkeys.createdAt,
          lastUsedAt: core_users_passkeys.lastUsedAt,
        })
        .from(core_users_passkeys)
        .where(eq(core_users_passkeys.userId, userId)),
      db
        .select({
          providerId: core_users_sso.providerId,
          providerEmail: core_users_sso.providerEmail,
          providerUsername: core_users_sso.providerUsername,
          createdAt: core_users_sso.createdAt,
        })
        .from(core_users_sso)
        .where(eq(core_users_sso.userId, userId)),
      db
        .select({
          id: core_files.id,
          name: core_files.name,
          mimeType: core_files.mimeType,
          size: core_files.size,
          visibility: core_files.visibility,
          createdAt: core_files.createdAt,
        })
        .from(core_files)
        .where(eq(core_files.userId, userId)),
      db
        .select({
          id: core_payments.id,
          pluginId: core_payments.pluginId,
          description: core_payments.description,
          amount: core_payments.amount,
          currency: core_payments.currency,
          status: core_payments.status,
          createdAt: core_payments.createdAt,
          completedAt: core_payments.completedAt,
        })
        .from(core_payments)
        .where(eq(core_payments.userId, userId)),
      db
        .select({
          points: core_moderation_warnings.points,
          message: core_moderation_warnings.message,
          issuedAt: core_moderation_warnings.issuedAt,
          expiresAt: core_moderation_warnings.expiresAt,
          revokedAt: core_moderation_warnings.revokedAt,
        })
        .from(core_moderation_warnings)
        .where(eq(core_moderation_warnings.userId, userId)),
      db
        .select({
          type: core_moderation_sanctions.type,
          startsAt: core_moderation_sanctions.startsAt,
          endsAt: core_moderation_sanctions.endsAt,
        })
        .from(core_moderation_sanctions)
        .where(eq(core_moderation_sanctions.userId, userId)),
      db
        .select({
          reason: core_moderation_reports.reason,
          description: core_moderation_reports.description,
          targetTitle: core_moderation_reports.targetTitle,
          status: core_moderation_reports.status,
          createdAt: core_moderation_reports.createdAt,
        })
        .from(core_moderation_reports)
        .where(eq(core_moderation_reports.reporterId, userId)),
      db
        .select({
          status: core_users_deletions.status,
          scheduledAt: core_users_deletions.scheduledAt,
          createdAt: core_users_deletions.createdAt,
          cancelledAt: core_users_deletions.cancelledAt,
        })
        .from(core_users_deletions)
        .where(eq(core_users_deletions.userId, userId)),
    ]);

    return {
      profile: profile
        ? {
            ...profile,
            birthday: iso(profile.birthday),
            createdAt: iso(profile.createdAt),
            lastSeenAt: iso(profile.lastSeenAt),
          }
        : null,
      secondaryRoles: secondaryRoles.map(row => ({
        ...row,
        since: iso(row.since),
      })),
      devices: devices.map(row => ({ ...row, lastSeen: iso(row.lastSeen) })),
      passkeys: passkeys.map(row => ({
        ...row,
        createdAt: iso(row.createdAt),
        lastUsedAt: iso(row.lastUsedAt),
      })),
      ssoConnections: sso.map(row => ({
        ...row,
        createdAt: iso(row.createdAt),
      })),
      files: files.map(row => ({ ...row, createdAt: iso(row.createdAt) })),
      payments: payments.map(row => ({
        ...row,
        createdAt: iso(row.createdAt),
        completedAt: iso(row.completedAt),
      })),
      warnings: warnings.map(row => ({
        points: row.points,
        message: row.message,
        issuedAt: iso(row.issuedAt),
        expiresAt: iso(row.expiresAt),
        revokedAt: iso(row.revokedAt),
      })),
      sanctions: sanctions.map(row => ({
        ...row,
        startsAt: iso(row.startsAt),
        endsAt: iso(row.endsAt),
      })),
      reportsFiled: reports.map(row => ({
        ...row,
        createdAt: iso(row.createdAt),
      })),
      chat: await exportChatData(c, userId),
      accountDeletionRequests: deletions.map(row => ({
        ...row,
        scheduledAt: iso(row.scheduledAt),
        createdAt: iso(row.createdAt),
        cancelledAt: iso(row.cancelledAt),
      })),
    };
  },

  erase: async ({ tx, userId }) => {
    await tx.delete(core_logs).where(eq(core_logs.userId, userId));
    await eraseChatData(tx, userId);

    await tx
      .update(core_audit_logs)
      .set({ actorName: null, ipAddress: null })
      .where(eq(core_audit_logs.actorId, userId));
    await tx
      .update(core_audit_logs)
      .set({ targetLabel: null })
      .where(
        and(
          eq(core_audit_logs.pluginId, manifest.id),
          eq(core_audit_logs.targetType, "user"),
          eq(core_audit_logs.targetId, String(userId)),
        ),
      );

    await tx
      .update(core_payments)
      .set({ checkoutUrl: null })
      .where(eq(core_payments.userId, userId));
  },
});
