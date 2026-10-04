import type { NotificationEmailMode } from "@/lib/notifications/types";
import type { NotificationPreferenceTypeView } from "@/views/notifications/notifications-query";

export type EmailChannelState = "off" | "on" | "unavailable";

const emailEditableTypes = (types: NotificationPreferenceTypeView[]) =>
  types.filter(type => !type.locked && type.emailModes.length > 0);

export const emailChannelState = (
  types: NotificationPreferenceTypeView[],
): EmailChannelState => {
  const editable = emailEditableTypes(types);
  if (editable.length === 0) return "unavailable";

  return editable.some(type => type.value.email !== "none") ? "on" : "off";
};

const turnOnMode = (
  type: NotificationPreferenceTypeView,
): NotificationEmailMode => {
  if (type.defaultEmail !== "none") return type.defaultEmail;

  return type.emailModes.includes("daily") ? "daily" : "immediate";
};

export const emailOnPatch = (
  types: NotificationPreferenceTypeView[],
  before: null | Record<string, NotificationEmailMode>,
): Record<string, { email: NotificationEmailMode }> =>
  Object.fromEntries(
    emailEditableTypes(types).map(type => {
      const previous = before?.[type.id];

      return [
        type.id,
        {
          email: previous && previous !== "none" ? previous : turnOnMode(type),
        },
      ];
    }),
  );

export const emailOffPatch = (types: NotificationPreferenceTypeView[]) =>
  Object.fromEntries(
    emailEditableTypes(types).map(type => [
      type.id,
      { email: "none" as const },
    ]),
  );

export const emailSnapshot = (types: NotificationPreferenceTypeView[]) =>
  Object.fromEntries(
    emailEditableTypes(types).map(type => [type.id, type.value.email]),
  );
