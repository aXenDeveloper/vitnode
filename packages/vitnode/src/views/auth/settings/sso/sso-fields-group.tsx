import type React from "react";

import { cn } from "cn";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { SsoProfileField } from "@/lib/sso-profile";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { SSO_PROFILE_FIELDS } from "@/lib/sso-profile";

import type { SaveSsoPreferences } from "./sso-connections-mutations";
import type { SsoConnectionsApi } from "./sso-connections-query";

import {
  SETTINGS_ROW,
  SETTINGS_ROW_LABEL,
  SettingsGroup,
} from "../settings-group";
import { sourceOptionsFor } from "./profile-field-state";

const MANUAL = "manual";

export interface SsoProfileSnapshot {
  avatarUrl: null | string;
  firstName: null | string;
  lastName: null | string;
}

const CurrentValue = ({
  field,
  profile,
}: {
  field: SsoProfileField;
  profile: SsoProfileSnapshot;
}) => {
  const t = useTranslations("core.auth.settings.sso");

  if (field === "avatar") {
    return profile.avatarUrl ? (
      <img
        alt=""
        className="size-8 rounded-full object-cover outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
        height={32}
        src={profile.avatarUrl}
        width={32}
      />
    ) : (
      <span className="text-muted-foreground">{t("value_not_set")}</span>
    );
  }

  const value = profile[field];

  return value ? (
    <span className="text-foreground wrap-anywhere">{value}</span>
  ) : (
    <span className="text-muted-foreground">{t("value_not_set")}</span>
  );
};

export const SsoFieldsGroup = ({
  data,
  onSavePreferences,
  profile,
}: {
  data: SsoConnectionsApi;
  onSavePreferences: SaveSsoPreferences;
  profile: SsoProfileSnapshot;
}) => {
  const t = useTranslations("core.auth.settings.sso");
  const tErrors = useTranslations("core.global.errors");

  const onChange = async (
    field: SsoProfileField,
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const providerId =
      event.target.value === MANUAL ? null : event.target.value;
    const result = await onSavePreferences({
      sources: { [field]: providerId },
      sync: {},
    });

    if (!result.ok) {
      toast.error(
        result.failure === "invalid_source"
          ? t("errors.invalid_source.title")
          : tErrors("title"),
        {
          description:
            result.failure === "invalid_source"
              ? t("errors.invalid_source.desc")
              : tErrors("internal_server_error"),
        },
      );

      return;
    }

    const fieldName = t(`fields.${field}`);
    toast.success(
      providerId
        ? t("source.saved_from", {
            field: fieldName,
            provider:
              data.providers.find(one => one.id === providerId)?.name ??
              providerId,
          })
        : t("source.saved_manual", { field: fieldName }),
    );
  };

  const rows = SSO_PROFILE_FIELDS.map(field => ({
    field,
    options: sourceOptionsFor(field, data.providers),
  })).filter(row => row.options.length > 0);

  if (rows.length === 0) return null;

  return (
    <SettingsGroup
      footer={t("sync.manual_edit_note")}
      title={t("groups.profile")}
    >
      {rows.map(({ field, options }) => {
        const selectId = `sso-source-${field}`;
        const current = data.sources[field];

        return (
          <li
            className={cn(SETTINGS_ROW, "flex-wrap sm:flex-nowrap")}
            key={field}
          >
            <label className={SETTINGS_ROW_LABEL} htmlFor={selectId}>
              {t(`fields.${field}`)}
            </label>
            <div className="flex min-w-0 flex-1 items-center text-sm">
              <CurrentValue field={field} profile={profile} />
            </div>
            <NativeSelect
              className="w-full sm:w-48"
              id={selectId}
              onChange={event => {
                void onChange(field, event);
              }}
              value={
                current && options.some(one => one.id === current)
                  ? current
                  : MANUAL
              }
            >
              <NativeSelectOption value={MANUAL}>
                {t("source.manual")}
              </NativeSelectOption>
              {options.map(provider => (
                <NativeSelectOption key={provider.id} value={provider.id}>
                  {t("source.from", { provider: provider.name })}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </li>
        );
      })}
    </SettingsGroup>
  );
};
