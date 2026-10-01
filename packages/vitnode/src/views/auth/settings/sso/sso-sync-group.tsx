import { cn } from "cn";
import { RefreshCwIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import type {
  SaveSsoPreferences,
  StartSsoConnection,
} from "./sso-connections-mutations";
import type {
  SsoConnectionProvider,
  SsoConnectionsApi,
} from "./sso-connections-query";

import { SETTINGS_ROW, SettingsGroup } from "../settings-group";
import { sourcedFieldsOf } from "./profile-field-state";
import { useStartFailureToast } from "./sso-start-feedback";

const SyncNowButton = ({
  onStart,
  provider,
}: {
  onStart: StartSsoConnection;
  provider: SsoConnectionProvider;
}) => {
  const t = useTranslations("core.auth.settings.sso");
  const showFailure = useStartFailureToast(provider.name);
  const [isPending, setIsPending] = React.useState(false);

  return (
    <Button
      aria-label={t("sync.sync_now_aria", { provider: provider.name })}
      isLoading={isPending}
      onClick={async () => {
        setIsPending(true);
        const result = await onStart({
          intent: "sync",
          providerId: provider.id,
        });

        if (!result.ok) {
          setIsPending(false);
          showFailure(result);
        }
      }}
      size="sm"
      variant="outline"
    >
      <RefreshCwIcon aria-hidden="true" />
      {t("sync.sync_now")}
    </Button>
  );
};

const SignInSwitch = ({
  onSavePreferences,
  provider,
}: {
  onSavePreferences: SaveSsoPreferences;
  provider: SsoConnectionProvider;
}) => {
  const t = useTranslations("core.auth.settings.sso");
  const tErrors = useTranslations("core.global.errors");
  const [isSaving, setIsSaving] = React.useState(false);

  return (
    <label className="text-foreground flex cursor-pointer items-center gap-2 text-sm">
      <Switch
        aria-label={t("sync.on_sign_in", { provider: provider.name })}
        checked={provider.connection?.syncOnSignIn ?? false}
        disabled={isSaving}
        onCheckedChange={async checked => {
          setIsSaving(true);
          const result = await onSavePreferences({
            sources: {},
            sync: { [provider.id]: checked },
          });
          setIsSaving(false);

          if (!result.ok) {
            toast.error(tErrors("title"), {
              description: tErrors("internal_server_error"),
            });
          }
        }}
      />
      <span aria-hidden="true">{t("sync.on_sign_in_short")}</span>
    </label>
  );
};

export const SsoSyncGroup = ({
  data,
  onSavePreferences,
  onStart,
}: {
  data: SsoConnectionsApi;
  onSavePreferences: SaveSsoPreferences;
  onStart: StartSsoConnection;
}) => {
  const t = useTranslations("core.auth.settings.sso");
  const rows = data.providers
    .filter(provider => provider.connection && provider.available)
    .map(provider => ({
      fields: sourcedFieldsOf(provider, data.sources),
      provider,
    }))
    .filter(row => row.fields.length > 0);

  if (rows.length === 0) return null;

  return (
    <SettingsGroup footer={t("sync.footer")} title={t("groups.sync")}>
      {rows.map(({ fields, provider }) => (
        <li
          className={cn(SETTINGS_ROW, "flex-wrap sm:flex-nowrap")}
          key={provider.id}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
            <span className="text-foreground font-medium wrap-anywhere">
              {provider.name}
            </span>
            <span className="text-muted-foreground">
              {fields.map(field => t(`fields.${field}`)).join(", ")}
            </span>
          </div>
          <div className="flex w-full items-center justify-end gap-4 sm:w-auto">
            <SignInSwitch
              onSavePreferences={onSavePreferences}
              provider={provider}
            />
            <SyncNowButton onStart={onStart} provider={provider} />
          </div>
        </li>
      ))}
    </SettingsGroup>
  );
};
