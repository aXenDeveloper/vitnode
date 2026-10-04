import { BellOffIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { NOTIFICATION_EMAIL_MODES } from "@/lib/notifications/types";

import type {
  NotificationsAdminActions,
  NotificationTypePolicyPatch,
} from "./notifications-mutations";
import type {
  AdminNotificationType,
  AdminNotificationTypePolicy,
} from "./notifications-query";

const isEmailMode = (
  value: string,
): value is (typeof NOTIFICATION_EMAIL_MODES)[number] =>
  (NOTIFICATION_EMAIL_MODES as readonly string[]).includes(value);

const SwitchField = ({
  checked,
  disabled,
  hint,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  disabled: boolean;
  hint?: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) => (
  <div className="flex flex-col gap-1">
    <Label className="font-normal">
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={value => {
          onCheckedChange(value);
        }}
        size="sm"
      />
      {label}
    </Label>
    {hint ? (
      <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
    ) : null}
  </div>
);

const TypeRow = ({
  canEdit,
  onUpdate,
  type,
}: {
  canEdit: boolean;
  onUpdate: NotificationsAdminActions["updateTypePolicy"];
  type: AdminNotificationType;
}) => {
  const t = useTranslations("admin.system.notifications.types");
  const tError = useTranslations("core.global.errors");
  const selectId = React.useId();
  const [isPending, startTransition] = React.useTransition();
  const [policy, applyOptimistic] = React.useOptimistic(
    type.policy,
    (
      current: AdminNotificationTypePolicy,
      patch: NotificationTypePolicyPatch,
    ): AdminNotificationTypePolicy => ({ ...current, ...patch }),
  );

  const save = (patch: NotificationTypePolicyPatch) => {
    startTransition(async () => {
      applyOptimistic(patch);
      const mutation = await onUpdate(type.id, patch);

      if (mutation.error !== undefined) {
        toast.error(tError("title"), {
          description: tError("internal_server_error"),
        });

        return;
      }

      toast.success(t("success"), {
        description: t("success_desc", { type: type.id }),
      });
    });
  };

  const isLocked = !canEdit || isPending;
  const defaultInApp = policy.inApp ?? type.defaults.inApp;
  const defaultEmail = policy.email ?? type.defaults.email;

  return (
    <li
      aria-busy={isPending}
      className="flex flex-col gap-4 border-b py-4 last:border-b-0 lg:flex-row lg:items-start lg:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="font-mono text-sm font-medium break-all">{type.id}</h3>
          <p className="text-muted-foreground text-sm">
            {type.pluginId} · {type.category} ·{" "}
            {t("version", { version: type.version })}
          </p>
        </div>
        <ul className="flex flex-wrap gap-2">
          <li>
            <Badge variant="secondary">{t("in_app")}</Badge>
          </li>
          {type.emailSupported ? (
            <li>
              <Badge variant={type.emailAvailable ? "success" : "warning"}>
                {type.emailAvailable ? t("email") : t("email_unavailable")}
              </Badge>
            </li>
          ) : null}
          {type.grouped ? (
            <li>
              <Badge variant="outline">{t("grouped")}</Badge>
            </li>
          ) : null}
          {type.mandatory ? (
            <li>
              <Badge variant="outline">{t("mandatory")}</Badge>
            </li>
          ) : null}
        </ul>
      </div>

      <div className="grid shrink-0 gap-4 sm:grid-cols-2 lg:w-md">
        <SwitchField
          checked={type.mandatory || policy.enabled}
          disabled={isLocked || type.mandatory}
          hint={type.mandatory ? t("enabled_mandatory") : undefined}
          label={t("enabled")}
          onCheckedChange={enabled => {
            save({ enabled });
          }}
        />
        <SwitchField
          checked={defaultInApp}
          disabled={isLocked}
          label={t("default_in_app")}
          onCheckedChange={inApp => {
            save({ inApp });
          }}
        />
        {type.emailSupported ? (
          <>
            <SwitchField
              checked={policy.allowEmail}
              disabled={isLocked}
              label={t("allow_email")}
              onCheckedChange={allowEmail => {
                save({ allowEmail });
              }}
            />
            <div className="flex flex-col gap-2">
              <Label className="font-normal" htmlFor={selectId}>
                {t("default_email")}
              </Label>
              <NativeSelect
                className="w-full"
                disabled={isLocked || !policy.allowEmail}
                id={selectId}
                onChange={event => {
                  const email = event.target.value;
                  if (isEmailMode(email)) save({ email });
                }}
                size="sm"
                value={defaultEmail}
              >
                {NOTIFICATION_EMAIL_MODES.map(mode => (
                  <NativeSelectOption key={mode} value={mode}>
                    {t(`email_modes.${mode}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </>
        ) : null}
      </div>
    </li>
  );
};

export const NotificationsTypesCard = ({
  canEdit,
  onUpdate,
  types,
}: {
  canEdit: boolean;
  onUpdate: NotificationsAdminActions["updateTypePolicy"];
  types: AdminNotificationType[];
}) => {
  const t = useTranslations("admin.system.notifications.types");

  return (
    <Card aria-labelledby="notifications-types" role="region">
      <CardHeader>
        <CardTitle>
          <h2 className="text-balance" id="notifications-types">
            {t("title")}
          </h2>
        </CardTitle>
        <CardDescription className="leading-relaxed text-pretty">
          {canEdit ? t("desc") : `${t("desc")} ${t("read_only")}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {types.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellOffIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{t("empty.title")}</EmptyTitle>
              <EmptyDescription>{t("empty.desc")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col">
            {types.map(type => (
              <TypeRow
                canEdit={canEdit}
                key={type.id}
                onUpdate={onUpdate}
                type={type}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
