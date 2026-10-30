import { z } from "zod";

import { resolveLangValue } from "@/lib/helpers/multi-lang";

import { buildNotificationType } from "./registry";

export const adminMessageNotification = buildNotificationType({
  id: "core.admin_message",
  version: 1,
  schema: z.object({
    description: z.string().max(1000).optional(),
    title: z.string().min(1).max(200),
  }),
  category: "system",
  label: "core.notifications.types.admin_message.label",
  description: "core.notifications.types.admin_message.description",
  defaults: { email: "none", inApp: true },
  present: ({ data }) => ({ body: data.description, title: data.title }),
});

const reasonTextSchema = z
  .array(z.object({ languageCode: z.string(), value: z.string() }))
  .nullable();

const ACCOUNT_STATUS_PATH = "/account-status";

/** Sent to a member when a moderator warns them. Never carries staff notes. */
export const warningIssuedNotification = buildNotificationType({
  id: "core.warning_issued",
  version: 1,
  schema: z.object({
    message: z.string().max(2000),
    points: z.number().int().min(0),
    reason: reasonTextSchema,
    warningId: z.number().int(),
  }),
  category: "account",
  label: "core.notifications.types.warning_issued.label",
  description: "core.notifications.types.warning_issued.description",
  defaults: { email: "immediate", inApp: true },
  email: true,
  mandatory: true,
  present: ({ data, locale, t }) => {
    const reason = data.reason ? resolveLangValue(data.reason, { locale }) : "";

    return {
      body: data.message,
      target: ACCOUNT_STATUS_PATH,
      title: reason
        ? t("core.notifications.types.warning_issued.title_reason", {
            points: data.points,
            reason,
          })
        : t("core.notifications.types.warning_issued.title", {
            points: data.points,
          }),
    };
  },
});

/** Sent to a member when a warning of theirs is revoked. */
export const warningRevokedNotification = buildNotificationType({
  id: "core.warning_revoked",
  version: 1,
  schema: z.object({
    points: z.number().int().min(0),
    reason: reasonTextSchema,
    warningId: z.number().int(),
  }),
  category: "account",
  label: "core.notifications.types.warning_revoked.label",
  description: "core.notifications.types.warning_revoked.description",
  defaults: { email: "none", inApp: true },
  email: true,
  mandatory: true,
  present: ({ data, t }) => ({
    body: t("core.notifications.types.warning_revoked.body", {
      points: data.points,
    }),
    target: ACCOUNT_STATUS_PATH,
    title: t("core.notifications.types.warning_revoked.title"),
  }),
});

/** Sent to a member whose account a threshold suspended. */
export const accountSuspendedNotification = buildNotificationType({
  id: "core.account_suspended",
  version: 1,
  schema: z.object({
    endsAt: z.string().nullable(),
    sanctionId: z.number().int(),
  }),
  category: "account",
  label: "core.notifications.types.account_suspended.label",
  description: "core.notifications.types.account_suspended.description",
  defaults: { email: "immediate", inApp: true },
  email: true,
  mandatory: true,
  present: ({ data, locale, t }) => ({
    body: data.endsAt
      ? t("core.notifications.types.account_suspended.body_until", {
          endsAt: new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "UTC",
          }).format(new Date(data.endsAt)),
        })
      : t("core.notifications.types.account_suspended.body_indefinite"),
    target: ACCOUNT_STATUS_PATH,
    title: t("core.notifications.types.account_suspended.title"),
  }),
});

/** Sent to a member when staff lift one of their suspensions. */
export const suspensionRevokedNotification = buildNotificationType({
  id: "core.suspension_revoked",
  version: 1,
  schema: z.object({ sanctionId: z.number().int() }),
  category: "account",
  label: "core.notifications.types.suspension_revoked.label",
  description: "core.notifications.types.suspension_revoked.description",
  defaults: { email: "immediate", inApp: true },
  email: true,
  mandatory: true,
  present: ({ t }) => ({
    body: t("core.notifications.types.suspension_revoked.body"),
    target: ACCOUNT_STATUS_PATH,
    title: t("core.notifications.types.suspension_revoked.title"),
  }),
});

export const coreNotificationTypes = [
  adminMessageNotification,
  warningIssuedNotification,
  warningRevokedNotification,
  accountSuspendedNotification,
  suspensionRevokedNotification,
];
