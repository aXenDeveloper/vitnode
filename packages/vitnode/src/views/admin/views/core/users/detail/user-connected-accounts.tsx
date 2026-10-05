import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  KeyRoundIcon,
  RefreshCwIcon,
  Settings2Icon,
  UnplugIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { SsoConnectionsApi } from "@/views/auth/settings/sso/sso-connections-query";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipWithContent,
} from "@/components/ui/tooltip";
import { SSO_PROFILE_FIELDS } from "@/lib/sso-profile";
import {
  SETTINGS_ROW,
  SettingsGroup,
} from "@/views/auth/settings/settings-group";
import { SsoFieldsGroup } from "@/views/auth/settings/sso/sso-fields-group";
import { SsoProviderMark } from "@/views/auth/settings/sso/sso-provider-badge";
import { normalizeSSOProviders } from "@/views/auth/sso/providers";

import type { AdminUserDetail } from "./user-query";

import { EditSheetContent } from "./edit-sheet-content";
import {
  disconnectAdminUserSso,
  updateAdminUserSsoPreferences,
} from "./user-account-mutations";
import {
  adminUserSsoQueryOptions,
  countSignInMethods,
} from "./user-account-query";
import { DetailCardTitle } from "./user-profile-cards";
import { adminUserQueryKey } from "./user-query";

type Provider = SsoConnectionsApi["providers"][number];

const sourcedFields = (data: SsoConnectionsApi, providerId: string) =>
  SSO_PROFILE_FIELDS.filter(field => data.sources[field] === providerId);

const SyncSwitch = ({
  onToggle,
  provider,
}: {
  onToggle: (checked: boolean) => Promise<void>;
  provider: Provider;
}) => {
  const tSso = useTranslations("core.auth.settings.sso");
  const [isSaving, setIsSaving] = React.useState(false);

  return (
    <Switch
      aria-label={tSso("sync.on_sign_in", { provider: provider.name })}
      checked={provider.connection?.syncOnSignIn ?? false}
      disabled={isSaving}
      onCheckedChange={async checked => {
        setIsSaving(true);
        await onToggle(checked);
        setIsSaving(false);
      }}
    />
  );
};

const EditSsoDialog = ({
  data,
  onSaved,
  user,
}: {
  data: SsoConnectionsApi;
  onSaved: () => Promise<void>;
  user: AdminUserDetail;
}) => {
  const t = useTranslations("admin.user.show.sso");
  const tSso = useTranslations("core.auth.settings.sso");
  const tError = useTranslations("core.global.errors");
  const connected = data.providers.filter(provider => provider.connection);
  const views = normalizeSSOProviders(
    data.providers.map(({ icon, id, name }) => ({ icon, id, name })),
  );

  return (
    <Dialog>
      <TooltipWithContent text={t("edit")}>
        <DialogTrigger
          render={
            <Button aria-label={t("edit")} size="icon-sm" variant="ghost" />
          }
        >
          <Settings2Icon />
        </DialogTrigger>
      </TooltipWithContent>
      <EditSheetContent
        description={<>{t("editDesc", { name: user.name })}</>}
        title={<>{t("editTitle")}</>}
      >
        <div className="flex flex-col gap-6">
          <SsoFieldsGroup
            data={data}
            onSavePreferences={async body => {
              const result = await updateAdminUserSsoPreferences(user.id, body);
              if ("error" in result) {
                return {
                  failure:
                    result.error.status === 400
                      ? "invalid_source"
                      : "server_error",
                  ok: false,
                };
              }
              await onSaved();

              return { ok: true };
            }}
            profile={{
              avatarUrl: user.avatarUrl,
              firstName: user.firstName,
              lastName: user.lastName,
            }}
          />
          <SettingsGroup footer={t("syncFooter")} title={t("syncTitle")}>
            {connected.map(provider => {
              const fields = sourcedFields(data, provider.id);

              return (
                <li className={SETTINGS_ROW} key={provider.id}>
                  <SsoProviderMark
                    provider={
                      views.find(view => view.id === provider.id) ?? {
                        id: provider.id,
                        name: provider.name,
                      }
                    }
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                    <span className="text-foreground font-medium">
                      {provider.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {fields.length > 0
                        ? fields
                            .map(field => tSso(`fields.${field}`))
                            .join(", ")
                        : t("syncNoFields")}
                    </span>
                  </div>
                  <SyncSwitch
                    onToggle={async checked => {
                      const result = await updateAdminUserSsoPreferences(
                        user.id,
                        { sources: {}, sync: { [provider.id]: checked } },
                      );
                      if ("error" in result) {
                        toast.error(tError("title"), {
                          description: tError("internal_server_error"),
                        });

                        return;
                      }
                      await onSaved();
                      toast.success(
                        checked
                          ? t("syncOn", { provider: provider.name })
                          : t("syncOff", { provider: provider.name }),
                      );
                    }}
                    provider={provider}
                  />
                </li>
              );
            })}
          </SettingsGroup>
        </div>
      </EditSheetContent>
    </Dialog>
  );
};

const DisconnectButton = ({
  disabledReason,
  onDisconnect,
  provider,
  userName,
}: {
  disabledReason?: string;
  onDisconnect: () => Promise<void>;
  provider: Provider;
  userName: string;
}) => {
  const t = useTranslations("admin.user.show.sso");
  const label = t("disconnect", { provider: provider.name });

  if (disabledReason) {
    return (
      <TooltipWithContent text={disabledReason}>
        <span>
          <Button aria-label={label} disabled size="icon-sm" variant="ghost">
            <UnplugIcon />
          </Button>
        </span>
      </TooltipWithContent>
    );
  }

  return (
    <Tooltip>
      <ConfirmActionAlertDialog
        description={t("disconnectDesc", {
          name: userName,
          provider: provider.name,
        })}
        icon={<UnplugIcon />}
        onSubmit={async ({ onClose }) => {
          await onDisconnect();
          onClose();
        }}
        textSubmit={t("disconnectSubmit")}
        title={t("disconnectTitle", { provider: provider.name })}
      >
        <TooltipTrigger
          render={<Button aria-label={label} size="icon-sm" variant="ghost" />}
        >
          <UnplugIcon />
        </TooltipTrigger>
      </ConfirmActionAlertDialog>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};

export const UserConnectedAccountsCard = ({
  adminUserId,
  canEdit,
  user,
}: {
  adminUserId: AdminIdentity;
  canEdit: boolean;
  user: AdminUserDetail;
}) => {
  const t = useTranslations("admin.user.show.sso");
  const tSso = useTranslations("core.auth.settings.sso");
  const tError = useTranslations("core.global.errors");
  const queryClient = useQueryClient();
  const key = { adminUserId, userId: user.id };
  const { data, isError, isPending } = useQuery(adminUserSsoQueryOptions(key));

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: adminUserQueryKey({ adminUserId, id: String(user.id) }),
    });
  };

  const connected =
    data?.providers.filter(provider => provider.connection) ?? [];
  const views = normalizeSSOProviders(
    (data?.providers ?? []).map(({ icon, id, name }) => ({ icon, id, name })),
  );
  const isLastMethod =
    countSignInMethods({ passkeys: data?.signIn.passkeys ?? 0, sso: data }) <=
    1;

  return (
    <Card className="w-full">
      <CardHeader>
        <DetailCardTitle icon={KeyRoundIcon}>{t("title")}</DetailCardTitle>
        {canEdit && data && connected.length > 0 && (
          <CardAction>
            <EditSsoDialog data={data} onSaved={refresh} user={user} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("loadError")}
          </p>
        ) : connected.length === 0 ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("empty")}
          </p>
        ) : (
          <ul className="divide-border -my-3 flex flex-col divide-y">
            {connected.map(provider => {
              const fields = sourcedFields(data, provider.id);
              const connection = provider.connection;
              if (!connection) return null;

              return (
                <li className="flex items-start gap-3 py-3" key={provider.id}>
                  <SsoProviderMark
                    provider={
                      views.find(view => view.id === provider.id) ?? {
                        id: provider.id,
                        name: provider.name,
                      }
                    }
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                    <span className="flex min-w-0 flex-col">
                      <span className="text-foreground truncate font-medium">
                        {connection.accountLabel ?? provider.name}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {provider.name}
                        {connection.email ? ` · ${connection.email}` : ""}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {t("connected")}{" "}
                        <DateFormat date={connection.connectedAt} />
                      </span>
                    </span>
                    {(fields.length > 0 || connection.syncOnSignIn) && (
                      <span className="flex flex-wrap gap-1">
                        {fields.length > 0 && (
                          <Badge variant="outline">
                            {t("sourceBadge", {
                              fields: fields
                                .map(field => tSso(`fields.${field}`))
                                .join(", "),
                            })}
                          </Badge>
                        )}
                        {connection.syncOnSignIn && (
                          <Badge variant="secondary">
                            <RefreshCwIcon />
                            {t("syncsBadge")}
                          </Badge>
                        )}
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <DisconnectButton
                      disabledReason={
                        isLastMethod ? t("lastMethod") : undefined
                      }
                      onDisconnect={async () => {
                        const result = await disconnectAdminUserSso(
                          user.id,
                          provider.id,
                        );
                        if ("error" in result) {
                          toast.error(
                            result.error.status === 409
                              ? t("lastMethod")
                              : tError("title"),
                            {
                              description:
                                result.error.status === 409
                                  ? t("lastMethodDesc")
                                  : tError("internal_server_error"),
                            },
                          );

                          return;
                        }
                        await refresh();
                        toast.success(
                          t("disconnected", { provider: provider.name }),
                          {
                            description: t("disconnectedDesc", {
                              name: user.name,
                            }),
                          },
                        );
                      }}
                      provider={provider}
                      userName={user.name}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
