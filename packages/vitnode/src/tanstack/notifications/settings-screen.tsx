import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type {
  NotificationPreferencesView,
  NotificationPreferenceTypeView,
} from "@/views/notifications/notifications-query";

import { PageTitle } from "@/components/ui/page-title";
import { updateNotificationPreferencesInBrowser } from "@/views/notifications/notifications-actions";
import {
  notificationPreferencesQueryKey,
  notificationPreferencesQueryOptions,
} from "@/views/notifications/notifications-query";
import { NotificationChannelsGroup } from "@/views/notifications/settings/channels-card";
import {
  emailChannelState,
  emailOffPatch,
  emailOnPatch,
  emailSnapshot,
} from "@/views/notifications/settings/email-channel";
import { NotificationTypeItem } from "@/views/notifications/settings/type-item";

import { sessionQueryOptions } from "../auth/session-query";

type EmailMode = NotificationPreferenceTypeView["value"]["email"];
type UpdateBody = Parameters<typeof updateNotificationPreferencesInBrowser>[0];

const usePreferenceSaver = (userId: number) => {
  const queryClient = useQueryClient();
  const t = useTranslations("core.auth.settings.notifications");
  const tErrors = useTranslations("core.global.errors");

  return React.useCallback(
    async (body: UpdateBody, description?: string): Promise<boolean> => {
      const key = notificationPreferencesQueryKey(userId);
      queryClient.setQueryData<NotificationPreferencesView>(key, data =>
        data
          ? {
              ...data,
              types: data.types.map(type =>
                body.types?.[type.id]
                  ? {
                      ...type,
                      value: { ...type.value, ...body.types[type.id] },
                    }
                  : type,
              ),
            }
          : data,
      );

      let saved = true;
      try {
        await updateNotificationPreferencesInBrowser(body);
        toast.success(t("saved"), {
          description: description ?? t("saved_desc"),
        });
      } catch {
        saved = false;
        toast.error(tErrors("title"), {
          description: tErrors("internal_server_error"),
        });
      }
      await queryClient.invalidateQueries({ queryKey: key });

      return saved;
    },
    [queryClient, t, tErrors, userId],
  );
};

export const NotificationSettingsPanel = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.auth.settings.notifications");
  const tSettings = useTranslations("core.auth.settings");
  const { data } = useSuspenseQuery(
    notificationPreferencesQueryOptions({ userId }),
  );
  const { data: session } = useSuspenseQuery(sessionQueryOptions());
  const save = usePreferenceSaver(userId);
  const [openId, setOpenId] = React.useState<null | string>(null);
  const [emailBeforeStop, setEmailBeforeStop] = React.useState<null | Record<
    string,
    EmailMode
  >>(null);

  const groups = [
    ...data.types
      .reduce((map, type) => {
        const group = map.get(type.category) ?? {
          label: type.categoryLabel,
          types: [],
        };
        group.types.push(type);

        return map.set(type.category, group);
      }, new Map<string, { label: string; types: NotificationPreferenceTypeView[] }>())
      .values(),
  ];

  const setEmail = (on: boolean) => {
    if (on) {
      void save(
        { types: emailOnPatch(data.types, emailBeforeStop) },
        emailBeforeStop
          ? t("channels.email.restored_toast_desc")
          : t("channels.email.on_toast_desc"),
      );
      setEmailBeforeStop(null);

      return;
    }

    setEmailBeforeStop(emailSnapshot(data.types));
    void save(
      { types: emailOffPatch(data.types) },
      t("channels.email.stopped_toast_desc"),
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <PageTitle
        className="mb-0"
        desc={t("desc")}
        h1={t("title")}
        subtitle={tSettings("title")}
      />

      <NotificationChannelsGroup
        email={session.user?.email ?? ""}
        emailState={emailChannelState(data.types)}
        onEmailChange={setEmail}
      />

      <section
        aria-labelledby="notification-types"
        className="flex flex-col gap-2"
      >
        <h2
          className="text-muted-foreground text-sm font-medium"
          id="notification-types"
        >
          {t("types.title")}
        </h2>
        {groups.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("types.empty")}</p>
        ) : (
          <ul className="bg-card ring-foreground/10 overflow-hidden rounded-md shadow-xs ring-1">
            {groups.map(group => (
              <React.Fragment key={group.label}>
                {groups.length > 1 ? (
                  <li className="bg-muted/40 text-muted-foreground border-b px-4 py-2 text-xs font-medium">
                    <h3>{group.label}</h3>
                  </li>
                ) : null}
                {group.types.map(type => (
                  <NotificationTypeItem
                    isOpen={openId === type.id}
                    key={type.id}
                    onChange={patch => {
                      void save({ types: { [type.id]: patch } });
                    }}
                    onToggle={() => {
                      setOpenId(current =>
                        current === type.id ? null : type.id,
                      );
                    }}
                    type={type}
                  />
                ))}
              </React.Fragment>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
