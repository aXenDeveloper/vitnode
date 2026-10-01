import { UnlinkIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";

import type { DisconnectSsoConnection } from "./sso-connections-mutations";
import type { SsoSignInHint } from "./sso-last-method-hint";

export const DisconnectSsoButton = ({
  hints,
  onDisconnect,
  providerId,
  providerName,
}: {
  hints: SsoSignInHint[];
  onDisconnect: DisconnectSsoConnection;
  providerId: string;
  providerName: string;
}) => {
  const t = useTranslations("core.auth.settings.sso");
  const tErrors = useTranslations("core.global.errors");

  return (
    <ConfirmActionAlertDialog
      description={
        <span className="flex flex-col gap-2">
          <span>{t("disconnect.desc", { provider: providerName })}</span>
          <span>
            {t("disconnect.provider_note", { provider: providerName })}
          </span>
        </span>
      }
      onSubmit={async ({ onClose }) => {
        const result = await onDisconnect({ providerId });

        if (result.ok) {
          toast.success(t("disconnect.success"), {
            description: t("disconnect.success_desc", {
              provider: providerName,
            }),
          });
          onClose();

          return;
        }

        if (result.failure === "last_sign_in_method") {
          toast.error(t("errors.last_sign_in_method.title"), {
            description: [
              t("errors.last_sign_in_method.desc"),
              ...hints.map(hint =>
                t(`errors.last_sign_in_method.hint_${hint}`),
              ),
            ].join(" "),
          });
          onClose();

          return;
        }

        if (result.failure === "not_connected") {
          toast.error(t("errors.not_connected.title"), {
            description: t("errors.not_connected.desc"),
          });
          onClose();

          return;
        }

        toast.error(tErrors("title"), {
          description: tErrors("internal_server_error"),
        });
      }}
      submitVariant="destructive"
      textSubmit={t("disconnect.confirm")}
      title={t("disconnect.title", { provider: providerName })}
    >
      <Button size="sm" variant="destructive">
        <UnlinkIcon aria-hidden="true" />
        {t("disconnect.action")}
      </Button>
    </ConfirmActionAlertDialog>
  );
};
