import { cn } from "cn";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";

import type { SSOProvider } from "../../sso/providers";
import type {
  DisconnectSsoConnection,
  StartSsoConnection,
} from "./sso-connections-mutations";
import type { SsoConnectionsApi } from "./sso-connections-query";

import { SETTINGS_ROW, SettingsGroup } from "../settings-group";
import { ConnectSsoButton } from "./connect-sso-button";
import { DisconnectSsoButton } from "./disconnect-sso-button";
import { ImportSsoButton } from "./import-sso-button";
import { ssoSignInHints } from "./sso-last-method-hint";
import { SsoProviderMark } from "./sso-provider-badge";

export const SsoAccountsGroup = ({
  data,
  onDisconnect,
  onStart,
  views,
}: {
  data: SsoConnectionsApi;
  onDisconnect: DisconnectSsoConnection;
  onStart: StartSsoConnection;
  views: SSOProvider[];
}) => {
  const t = useTranslations("core.auth.settings.sso");

  return (
    <SettingsGroup title={t("groups.accounts")}>
      {data.providers.length === 0 ? (
        <li className={cn(SETTINGS_ROW, "text-muted-foreground text-sm")}>
          {t("empty")}
        </li>
      ) : (
        data.providers.map(provider => {
          const { connection } = provider;

          return (
            <li
              className={cn(SETTINGS_ROW, "flex-wrap sm:flex-nowrap")}
              key={provider.id}
            >
              <SsoProviderMark
                provider={
                  views.find(view => view.id === provider.id) ?? {
                    id: provider.id,
                    name: provider.name,
                  }
                }
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                <span className="text-foreground font-medium wrap-anywhere">
                  {provider.name}
                </span>
                {connection ? (
                  <>
                    <span className="text-muted-foreground wrap-anywhere">
                      {connection.accountLabel ?? t("account_unknown")}
                    </span>
                    <span className="text-muted-foreground">
                      {t("connected_at")}{" "}
                      <DateFormat date={connection.connectedAt} />
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    {provider.available
                      ? t("status.not_connected")
                      : t("unavailable_desc")}
                  </span>
                )}
              </div>
              <div className="flex w-full shrink-0 justify-end gap-2 sm:w-auto">
                {connection &&
                provider.available &&
                provider.profileFields.length > 0 ? (
                  <ImportSsoButton
                    fields={provider.profileFields}
                    onStart={onStart}
                    providerId={provider.id}
                    providerName={provider.name}
                  />
                ) : null}
                {connection ? (
                  <DisconnectSsoButton
                    hints={ssoSignInHints({
                      providerId: provider.id,
                      providers: data.providers,
                      signIn: data.signIn,
                    })}
                    onDisconnect={onDisconnect}
                    providerId={provider.id}
                    providerName={provider.name}
                  />
                ) : null}
                {!connection && provider.available ? (
                  <ConnectSsoButton
                    onStart={onStart}
                    providerId={provider.id}
                    providerName={provider.name}
                  />
                ) : null}
              </div>
            </li>
          );
        })
      )}
    </SettingsGroup>
  );
};
