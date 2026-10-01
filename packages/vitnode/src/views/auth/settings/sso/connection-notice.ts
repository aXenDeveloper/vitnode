import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { SSO_PROFILE_FIELDS } from "@/lib/sso-profile";

import type { SsoConnectionCallbackTarget } from "./connection-callback";

export const useSsoConnectionNotice = (providerName: string) => {
  const t = useTranslations("core.auth.settings.sso");
  const tErrors = useTranslations("core.global.errors");

  return (target: SsoConnectionCallbackTarget): void => {
    if (target.connected) {
      toast.success(t("connect.success"), {
        description: t("connect.success_desc", { provider: providerName }),
      });

      return;
    }

    if (target.synced) {
      const results = target.results ?? {};
      const updated = SSO_PROFILE_FIELDS.filter(
        field => results[field] === "updated",
      );
      const avatarFailed = results.avatar === "failed";

      if (updated.length > 0) {
        toast.success(t("sync.synced"), {
          description: [
            t("sync.synced_desc", {
              fields: updated.map(field => t(`fields.${field}`)).join(", "),
              provider: providerName,
            }),
            ...(avatarFailed ? [t("preview.avatar_failed")] : []),
          ].join(" "),
        });
      } else if (avatarFailed) {
        toast.error(t("preview.avatar_failed"));
      } else {
        toast.info(t("sync.up_to_date", { provider: providerName }));
      }

      return;
    }

    const { error } = target;
    if (!error) return;

    if (error === "server_error") {
      toast.error(tErrors("title"), {
        description: tErrors("internal_server_error"),
      });

      return;
    }

    toast.error(t(`errors.${error}.title`, { provider: providerName }), {
      description: t(`errors.${error}.desc`, { provider: providerName }),
    });
  };
};
