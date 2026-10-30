import {
  AUDIT_ACTION_MAX_LENGTH,
  AUDIT_ACTION_PATTERN,
  AUDIT_TARGET_TYPE_MAX_LENGTH,
  AUDIT_TARGET_TYPE_PATTERN,
} from "./const";

/**
 * One audit action a plugin records, declared so the Activity Logs filters can
 * offer it before it has ever happened.
 *
 * Its label is not part of the declaration: the AdminCP translates
 * `{pluginId}.audit.actions.{action}` from the plugin's own locale file (dots
 * in the action nest, so `topic.moved` is `audit.actions.topic.moved`), and
 * falls back to the action id itself. Nothing a plugin declares runs when an
 * entry is rendered, which is what keeps entries readable after the plugin is
 * uninstalled.
 */
export interface AuditActionDefinition {
  /** `topic.moved` - lowercase words joined by dots, unique within the plugin. */
  action: string;
  /** What it acts on: `topic`, `order`, `settings`. */
  targetType: string;
}

/**
 * Declares the audit actions a plugin records with `c.get("audit").record()`.
 * Pass the result to `buildApiPlugin({ auditActions })`. Universal.
 *
 * @throws When an action or target type is not a valid identifier, or an
 * action is declared twice.
 *
 * @example
 * ```ts
 * import { defineAuditActions } from "@vitnode/core/lib/audit/actions";
 *
 * export const siteNotesAuditActions = defineAuditActions([
 *   { action: "note.created", targetType: "note" },
 *   { action: "note.deleted", targetType: "note" },
 * ]);
 * ```
 */
export const defineAuditActions = <
  const TActions extends readonly AuditActionDefinition[],
>(
  actions: TActions,
): TActions => {
  const seen = new Set<string>();
  for (const { action, targetType } of actions) {
    if (
      action.length > AUDIT_ACTION_MAX_LENGTH ||
      !AUDIT_ACTION_PATTERN.test(action)
    ) {
      throw new Error(
        `Audit action "${action}" must be lowercase words joined by dots, like "topic.moved".`,
      );
    }
    if (
      targetType.length > AUDIT_TARGET_TYPE_MAX_LENGTH ||
      !AUDIT_TARGET_TYPE_PATTERN.test(targetType)
    ) {
      throw new Error(
        `Audit target type "${targetType}" of "${action}" must be a lowercase identifier.`,
      );
    }
    if (seen.has(action)) {
      throw new Error(`Audit action "${action}" is declared twice.`);
    }
    seen.add(action);
  }

  return actions;
};

/** The Content Engine's actions, recorded under the content type's plugin. */
export const CONTENT_AUDIT_ACTIONS = [
  "content.created",
  "content.updated",
  "content.deleted",
  "content.duplicated",
  "content.published",
  "content.unpublished",
  "content.hidden",
  "content.unhidden",
  "content.restored",
  "content.scheduled",
  "content.schedule_cancelled",
  "content.translation_created",
  "content.translation_updated",
  "content.translation_deleted",
  "content.translation_published",
  "content.translation_unpublished",
  "content.translation_restored",
  "content.access_updated",
  "content.access_files_protected",
] as const;

/** Everything core records under `@vitnode/core`. */
export const CORE_AUDIT_ACTIONS = defineAuditActions([
  { action: "role.created", targetType: "role" },
  { action: "role.updated", targetType: "role" },
  { action: "role.deleted", targetType: "role" },
  { action: "admin_permissions.created", targetType: "staff_entry" },
  { action: "admin_permissions.updated", targetType: "staff_entry" },
  { action: "admin_permissions.deleted", targetType: "staff_entry" },
  { action: "moderator_permissions.created", targetType: "staff_entry" },
  { action: "moderator_permissions.updated", targetType: "staff_entry" },
  { action: "moderator_permissions.deleted", targetType: "staff_entry" },
  { action: "user.updated", targetType: "user" },
  { action: "user.roles_changed", targetType: "user" },
  { action: "user.password_reset", targetType: "user" },
  { action: "user.email_verified", targetType: "user" },
  { action: "user.device_revoked", targetType: "user" },
  { action: "user.devices_revoked", targetType: "user" },
  { action: "settings.updated", targetType: "settings" },
  { action: "audit_settings.updated", targetType: "settings" },
  { action: "ai_access.role_updated", targetType: "role" },
  { action: "ai_access.user_override_saved", targetType: "user" },
  { action: "ai_access.user_override_removed", targetType: "user" },
  { action: "notifications.type_updated", targetType: "notification_type" },
  { action: "notifications.paused", targetType: "settings" },
  { action: "notifications.resumed", targetType: "settings" },
  { action: "notifications.emails_cancelled", targetType: "settings" },
  { action: "notifications.all_marked_read", targetType: "settings" },
  { action: "notifications.all_deleted", targetType: "settings" },
  { action: "notifications.member_preferences_reset", targetType: "settings" },
  { action: "report_reason.created", targetType: "report_reason" },
  { action: "report_reason.updated", targetType: "report_reason" },
  { action: "report_reason.deleted", targetType: "report_reason" },
  { action: "report_reason.reordered", targetType: "report_reason" },
  { action: "report.claimed", targetType: "report" },
  { action: "report.assigned", targetType: "report" },
  { action: "report.unassigned", targetType: "report" },
  { action: "report.note_added", targetType: "report" },
  { action: "report.note_edited", targetType: "report" },
  { action: "report.note_deleted", targetType: "report" },
  { action: "report.resolved", targetType: "report" },
  { action: "report.reopened", targetType: "report" },
  { action: "report.action_taken", targetType: "report" },
  { action: "submission.approved", targetType: "submission" },
  { action: "submission.rejected", targetType: "submission" },
  { action: "cron.run", targetType: "cron_job" },
  { action: "payment.created", targetType: "payment" },
  { action: "payment.processing", targetType: "payment" },
  { action: "payment.succeeded", targetType: "payment" },
  { action: "payment.failed", targetType: "payment" },
  { action: "payment.expired", targetType: "payment" },
  { action: "audit_logs.pruned", targetType: "settings" },
  { action: "audit_logs.exported", targetType: "settings" },
] as const);
