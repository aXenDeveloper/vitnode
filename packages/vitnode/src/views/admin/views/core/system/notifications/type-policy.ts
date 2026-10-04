import type { NotificationEmailMode } from "@/lib/notifications/types";

import type { NotificationTypePolicyPatch } from "./notifications-mutations";
import type { AdminNotificationType } from "./notifications-query";

export const LIST_CHOICES = ["default_on", "default_off", "disabled"] as const;
export const PUSH_CHOICES = ["available", "disabled"] as const;
export const EMAIL_CHOICES = ["default_on", "default_off", "disabled"] as const;

export type ListChoice = (typeof LIST_CHOICES)[number];
export type PushChoice = (typeof PUSH_CHOICES)[number];
export type EmailChoice = (typeof EMAIL_CHOICES)[number];

export interface TypeChoices {
  email: EmailChoice | null;
  list: ListChoice;
  memberCanEdit: boolean;
  push: PushChoice;
}

const emailModeOf = (type: AdminNotificationType): NotificationEmailMode =>
  type.policy.email ?? type.defaults.email;

export const choicesOf = (type: AdminNotificationType): TypeChoices => {
  const off = !type.policy.enabled && !type.mandatory;

  return {
    email: !type.emailSupported
      ? null
      : off || !type.policy.allowEmail
        ? "disabled"
        : emailModeOf(type) === "none"
          ? "default_off"
          : "default_on",
    list: type.mandatory
      ? "default_on"
      : off || !type.policy.allowInApp
        ? "disabled"
        : (type.policy.inApp ?? type.defaults.inApp)
          ? "default_on"
          : "default_off",
    memberCanEdit: !type.mandatory && type.policy.memberCanEdit,
    push: off || !type.policy.allowPush ? "disabled" : "available",
  };
};

export const isSentNowhere = (choices: TypeChoices): boolean =>
  choices.list === "disabled" &&
  choices.push === "disabled" &&
  (choices.email === null || choices.email === "disabled");

export const listPatch = (choice: ListChoice): NotificationTypePolicyPatch =>
  choice === "disabled"
    ? { allowInApp: false, enabled: true }
    : { allowInApp: true, enabled: true, inApp: choice === "default_on" };

export const pushPatch = (choice: PushChoice): NotificationTypePolicyPatch => ({
  allowPush: choice === "available",
  enabled: true,
});

export const emailPatch = (
  choice: EmailChoice,
  type: AdminNotificationType,
): NotificationTypePolicyPatch => {
  if (choice === "disabled") return { allowEmail: false, enabled: true };
  if (choice === "default_off") {
    return { allowEmail: true, email: "none", enabled: true };
  }

  const current = emailModeOf(type);
  const frequency =
    current !== "none"
      ? current
      : type.defaults.email !== "none"
        ? type.defaults.email
        : "immediate";

  return { allowEmail: true, email: frequency, enabled: true };
};

export const applyPatch = (
  type: AdminNotificationType,
  patch: NotificationTypePolicyPatch,
): AdminNotificationType => ({
  ...type,
  policy: {
    ...type.policy,
    ...Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ),
  },
});
