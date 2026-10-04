import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { LockIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type {
  NotificationPreferencesView,
  NotificationPreferenceTypeView,
} from "@/views/notifications/notifications-query";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormCombobox } from "@/components/form/fields/combobox";
import { AutoFormSelect } from "@/components/form/fields/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PageTitle } from "@/components/ui/page-title";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  setNotificationSubscriptionInBrowser,
  updateNotificationPreferencesInBrowser,
} from "@/views/notifications/notifications-actions";
import {
  notificationPreferencesQueryKey,
  notificationPreferencesQueryOptions,
  notificationSubscriptionsQueryKey,
  notificationSubscriptionsQueryOptions,
} from "@/views/notifications/notifications-query";

type EmailMode = NotificationPreferenceTypeView["value"]["email"];

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour));
const WEEKDAYS = ["0", "1", "2", "3", "4", "5", "6"];

const supportedTimeZones = (): string[] => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
};

const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
};

const usePreferenceSaver = (userId: number) => {
  const queryClient = useQueryClient();
  const t = useTranslations("core.auth.settings.notifications");
  const tErrors = useTranslations("core.global.errors");

  return React.useCallback(
    async (
      body: Parameters<typeof updateNotificationPreferencesInBrowser>[0],
      optimistic?: (
        data: NotificationPreferencesView,
      ) => NotificationPreferencesView,
    ) => {
      const key = notificationPreferencesQueryKey(userId);
      if (optimistic) {
        queryClient.setQueryData<NotificationPreferencesView>(key, data =>
          data ? optimistic(data) : data,
        );
      }
      try {
        await updateNotificationPreferencesInBrowser(body);
        toast.success(t("saved"), { description: t("saved_desc") });
      } catch {
        toast.error(tErrors("title"), {
          description: tErrors("internal_server_error"),
        });
      }
      await queryClient.invalidateQueries({ queryKey: key });
    },
    [queryClient, t, tErrors, userId],
  );
};

const PreferenceRow = ({
  onChange,
  type,
}: {
  onChange: (patch: { email?: EmailMode; inApp?: boolean }) => void;
  type: NotificationPreferenceTypeView;
}) => {
  const t = useTranslations("core.auth.settings.notifications");
  const switchId = `notification-in-app-${type.id}`;
  const emailId = `notification-email-${type.id}`;
  const modes = type.emailModes.map(mode => ({
    label: t(`email_modes.${mode}`),
    value: mode,
  }));

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-2 font-medium">
          {type.label}
          {type.mandatory ? (
            <Badge variant="secondary">
              <LockIcon />
              {t("mandatory")}
            </Badge>
          ) : null}
        </span>
        {type.description ? (
          <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {type.description}
          </span>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={type.value.inApp}
            disabled={type.mandatory}
            id={switchId}
            onCheckedChange={checked => onChange({ inApp: checked })}
          />
          <Label htmlFor={switchId}>{t("in_app")}</Label>
        </div>

        {modes.length > 0 ? (
          <div className="flex items-center gap-2">
            <Label className="sr-only" htmlFor={emailId}>
              {t("email")}
            </Label>
            <Select
              items={modes}
              onValueChange={value => {
                if (value) onChange({ email: value as EmailMode });
              }}
              value={type.value.email}
            >
              <SelectTrigger className="w-44" id={emailId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modes.map(mode => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">
            {type.mandatory && type.value.email !== "none"
              ? t(`email_modes.${type.value.email}`)
              : t("email_unavailable")}
          </span>
        )}
      </div>
    </li>
  );
};

const ScheduleForm = ({
  preferences,
  userId,
}: {
  preferences: NotificationPreferencesView;
  userId: number;
}) => {
  const t = useTranslations("core.auth.settings.notifications.schedule");
  const format = useFormatter();
  const save = usePreferenceSaver(userId);
  const zones = React.useMemo(() => {
    const list = supportedTimeZones();

    return list.includes("UTC") ? list : ["UTC", ...list];
  }, []);

  const formSchema = z.object({
    timeZone: z
      .enum(zones as [string, ...string[]])
      .default(preferences.timeZone ?? browserTimeZone()),
    digestHour: z
      .enum(HOURS as [string, ...string[]])
      .default(String(preferences.digestHour)),
    digestWeekday: z
      .enum(WEEKDAYS as [string, ...string[]])
      .default(String(preferences.digestWeekday)),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    await save({
      digestHour: Number(values.digestHour),
      digestWeekday: Number(values.digestWeekday),
      timeZone: values.timeZone,
    });
  };

  return (
    <AutoForm
      fields={[
        {
          id: "timeZone",
          component: props => (
            <AutoFormCombobox
              description={t("time_zone_desc")}
              label={t("time_zone")}
              {...props}
            />
          ),
        },
        {
          id: "digestHour",
          component: props => (
            <AutoFormSelect
              description={t("hour_desc")}
              label={t("hour")}
              labels={HOURS.map(hour => ({
                label: `${hour.padStart(2, "0")}:00`,
                value: hour,
              }))}
              {...props}
            />
          ),
        },
        {
          id: "digestWeekday",
          component: props => (
            <AutoFormSelect
              description={t("weekday_desc")}
              label={t("weekday")}
              labels={WEEKDAYS.map(day => ({
                // 7 January 2024 was a Sunday - day 0.
                label: format.dateTime(
                  new Date(Date.UTC(2024, 0, 7 + Number(day))),
                  { timeZone: "UTC", weekday: "long" },
                ),
                value: day,
              }))}
              {...props}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{ children: t("submit") }}
    />
  );
};

const SubscriptionsList = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.auth.settings.notifications.subscriptions");
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(
    notificationSubscriptionsQueryOptions({ userId }),
  );

  const clear = async (item: (typeof data)[number]) => {
    try {
      await setNotificationSubscriptionInBrowser({
        state: "none",
        subject: { id: item.subjectId, type: item.subjectType },
      });
      toast.success(item.state === "muted" ? t("unmuted") : t("unfollowed"), {
        description: item.label ?? item.subjectId,
      });
    } catch {
      toast.error(t("error"));
    }
    await queryClient.invalidateQueries({
      queryKey: notificationSubscriptionsQueryKey(userId),
    });
  };

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("empty")}
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {data.map(item => (
        <li
          className="flex items-center justify-between gap-3 py-3"
          key={`${item.subjectType}:${item.subjectId}`}
        >
          <span className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-medium">
              {item.label ?? `${item.subjectType} #${item.subjectId}`}
            </span>
            <span className="text-muted-foreground text-sm">
              {item.state === "muted" ? t("muted") : t("following")}
            </span>
          </span>
          <Button onClick={() => void clear(item)} size="sm" variant="outline">
            {item.state === "muted" ? t("unmute") : t("unfollow")}
          </Button>
        </li>
      ))}
    </ul>
  );
};

/** `/settings/notifications`: what reaches the user, where, and when. */
export const NotificationSettingsPanel = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.auth.settings.notifications");
  const tSettings = useTranslations("core.auth.settings");
  const { data } = useSuspenseQuery(
    notificationPreferencesQueryOptions({ userId }),
  );
  const save = usePreferenceSaver(userId);

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

  const change = (
    type: NotificationPreferenceTypeView,
    patch: { email?: EmailMode; inApp?: boolean },
  ) =>
    void save({ types: { [type.id]: patch } }, current => ({
      ...current,
      types: current.types.map(entry =>
        entry.id === type.id
          ? { ...entry, value: { ...entry.value, ...patch } }
          : entry,
      ),
    }));

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        className="mb-0"
        desc={t("desc")}
        h1={t("title")}
        subtitle={tSettings("title")}
      />

      {groups.map(group => (
        <Card key={group.label}>
          <CardHeader>
            <CardTitle>
              <h2>{group.label}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {group.types.map(type => (
                <PreferenceRow
                  key={type.id}
                  onChange={patch => change(type, patch)}
                  type={type}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("schedule.title")}</h2>
          </CardTitle>
          <CardDescription>{t("schedule.desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduleForm preferences={data} userId={userId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("subscriptions.title")}</h2>
          </CardTitle>
          <CardDescription>{t("subscriptions.desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SubscriptionsList userId={userId} />
        </CardContent>
      </Card>
    </div>
  );
};
