import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  FingerprintIcon,
  LockIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { SsoConnectionsApi } from "@/views/auth/settings/sso/sso-connections-query";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipWithContent,
} from "@/components/ui/tooltip";

import type { AdminUserPasskey } from "./user-account-query";
import type { AdminUserDetail } from "./user-query";

import { EditSheetContent } from "./edit-sheet-content";
import { useFailureToast } from "./use-failure-toast";
import { deleteAdminUserPasskey } from "./user-account-mutations";
import {
  adminUserPasskeysQueryOptions,
  adminUserSsoQueryOptions,
  countSignInMethods,
} from "./user-account-query";
import { DetailCardTitle } from "./user-profile-cards";
import { adminUserQueryKey } from "./user-query";

const PasswordForm = React.lazy(async () =>
  import("./user-security-forms").then(module => ({
    default: module.PasswordForm,
  })),
);

const RenamePasskeyForm = React.lazy(async () =>
  import("./user-security-forms").then(module => ({
    default: module.RenamePasskeyForm,
  })),
);

const SubHeading = ({
  children,
  count,
}: {
  children: string;
  count?: number;
}) => (
  <h3 className="text-muted-foreground flex items-center justify-between text-xs font-medium tracking-wide uppercase">
    {children}
    {count === undefined ? null : <span className="tabular-nums">{count}</span>}
  </h3>
);

const PasskeyRow = ({
  canEdit,
  isLastMethod,
  onSaved,
  passkey,
  user,
}: {
  canEdit: boolean;
  isLastMethod: boolean;
  onSaved: () => Promise<void>;
  passkey: AdminUserPasskey;
  user: AdminUserDetail;
}) => {
  const t = useTranslations("admin.user.show.security");
  const showFailure = useFailureToast();

  return (
    <li className="flex items-center gap-3">
      <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
        <FingerprintIcon aria-hidden className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col text-sm">
        <span className="text-foreground truncate font-medium">
          {passkey.name}
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {passkey.backedUp ? t("passkeySynced") : t("passkeyDeviceOnly")}
          {" · "}
          {passkey.lastUsedAt ? (
            <>
              {t("passkeyUsed")} <DateFormat date={passkey.lastUsedAt} />
            </>
          ) : (
            t("passkeyNeverUsed")
          )}
        </span>
      </div>
      {canEdit && (
        <div className="flex shrink-0">
          <Dialog>
            <TooltipWithContent text={t("passkeyRename")}>
              <DialogTrigger
                render={
                  <Button
                    aria-label={t("passkeyRenameLabel", {
                      name: passkey.name,
                    })}
                    size="icon-sm"
                    variant="ghost"
                  />
                }
              >
                <PencilIcon />
              </DialogTrigger>
            </TooltipWithContent>
            <EditSheetContent
              description={t("passkeyRenameDesc")}
              title={t("passkeyRenameTitle")}
            >
              <RenamePasskeyForm
                onSaved={onSaved}
                passkey={passkey}
                user={user}
              />
            </EditSheetContent>
          </Dialog>
          {isLastMethod ? (
            <TooltipWithContent text={t("lastMethod")}>
              <span>
                <Button
                  aria-label={t("passkeyDeleteLabel", {
                    name: passkey.name,
                  })}
                  disabled
                  size="icon-sm"
                  variant="ghost"
                >
                  <Trash2Icon />
                </Button>
              </span>
            </TooltipWithContent>
          ) : (
            <Tooltip>
              <ConfirmActionAlertDialog
                description={t("passkeyDeleteDesc", {
                  name: user.name,
                  passkey: passkey.name,
                })}
                icon={<Trash2Icon />}
                onSubmit={async ({ onClose }) => {
                  const result = await deleteAdminUserPasskey(
                    user.id,
                    passkey.id,
                  );
                  if ("error" in result) {
                    if (result.error.status === 409) {
                      toast.error(t("lastMethod"), {
                        description: t("lastMethodDesc"),
                      });
                    } else {
                      showFailure();
                    }

                    return;
                  }
                  await onSaved();
                  toast.success(t("passkeyDeleted"), {
                    description: t("passkeyDeletedDesc", {
                      passkey: passkey.name,
                    }),
                  });
                  onClose();
                }}
                textSubmit={t("passkeyDeleteSubmit")}
                title={t("passkeyDeleteTitle")}
              >
                <TooltipTrigger
                  render={
                    <Button
                      aria-label={t("passkeyDeleteLabel", {
                        name: passkey.name,
                      })}
                      size="icon-sm"
                      variant="ghost"
                    />
                  }
                >
                  <Trash2Icon />
                </TooltipTrigger>
              </ConfirmActionAlertDialog>
              <TooltipContent>{t("passkeyDelete")}</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </li>
  );
};

const PasswordSection = ({
  canEdit,
  onSaved,
  sso,
  user,
}: {
  canEdit: boolean;
  onSaved: () => Promise<void>;
  sso: UseQueryResult<SsoConnectionsApi>;
  user: AdminUserDetail;
}) => {
  const t = useTranslations("admin.user.show.security");
  const hasPassword = sso.data?.signIn.hasPassword === true;

  return (
    <section className="flex flex-col gap-2">
      <SubHeading>{t("password")}</SubHeading>
      <div className="flex items-center gap-3">
        <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
          <LockIcon aria-hidden className="size-4" />
        </span>
        <span className="text-foreground flex-1 text-sm">
          {sso.isPending ? (
            <Skeleton className="h-4 w-32" />
          ) : sso.isError ? (
            <span className="text-muted-foreground">
              {t("passwordLoadError")}
            </span>
          ) : !sso.data.signIn.passwordEnabled ? (
            <span className="text-muted-foreground">
              {t("passwordDisabled")}
            </span>
          ) : hasPassword ? (
            t("passwordSet")
          ) : (
            t("passwordNotSet")
          )}
        </span>
        {canEdit && sso.data?.signIn.passwordEnabled === true && (
          <Dialog>
            <DialogTrigger render={<Button size="xs" variant="outline" />}>
              {hasPassword ? t("passwordChange") : t("passwordAdd")}
            </DialogTrigger>
            <EditSheetContent
              description={t("passwordDesc", { name: user.name })}
              title={t("passwordTitle")}
            >
              <PasswordForm onSaved={onSaved} user={user} />
            </EditSheetContent>
          </Dialog>
        )}
      </div>
    </section>
  );
};

const PasskeysSection = ({
  canEdit,
  enabled,
  isCapabilityError,
  isLastMethod,
  onSaved,
  query,
  user,
}: {
  canEdit: boolean;
  enabled: boolean;
  isCapabilityError: boolean;
  isLastMethod: boolean;
  onSaved: () => Promise<void>;
  query: UseQueryResult<AdminUserPasskey[]>;
  user: AdminUserDetail;
}) => {
  const t = useTranslations("admin.user.show.security");

  return (
    <section className="flex flex-col gap-2">
      <SubHeading count={query.data?.length}>{t("passkeys")}</SubHeading>
      {!enabled ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("passkeysDisabled")}
        </p>
      ) : isCapabilityError || query.isError ? (
        <p className="text-muted-foreground text-sm">
          {t("passkeysLoadError")}
        </p>
      ) : query.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : query.data.length === 0 ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("passkeysEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {query.data.map(passkey => (
            <PasskeyRow
              canEdit={canEdit}
              isLastMethod={isLastMethod}
              key={passkey.id}
              onSaved={onSaved}
              passkey={passkey}
              user={user}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

export const UserSecurityPanel = ({
  adminUserId,
  canEdit,
  user,
}: {
  adminUserId: AdminIdentity;
  canEdit: boolean;
  user: AdminUserDetail;
}) => {
  const t = useTranslations("admin.user.show.security");
  const queryClient = useQueryClient();
  const key = { adminUserId, userId: user.id };
  const sso = useQuery(adminUserSsoQueryOptions(key));
  const passkeysEnabled = sso.data?.signIn.passkeysEnabled === true;
  const passkeys = useQuery({
    ...adminUserPasskeysQueryOptions(key),
    enabled: passkeysEnabled,
  });
  const isLastMethod =
    countSignInMethods({
      passkeys: passkeys.data?.length ?? 0,
      sso: sso.data,
    }) <= 1;

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: adminUserQueryKey({ adminUserId, id: String(user.id) }),
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <DetailCardTitle icon={LockIcon}>{t("title")}</DetailCardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <PasswordSection
          canEdit={canEdit}
          onSaved={refresh}
          sso={sso}
          user={user}
        />
        <PasskeysSection
          canEdit={canEdit}
          enabled={!sso.isSuccess || passkeysEnabled}
          isCapabilityError={sso.isError}
          isLastMethod={isLastMethod}
          onSaved={refresh}
          query={passkeys}
          user={user}
        />
      </CardContent>
    </Card>
  );
};
