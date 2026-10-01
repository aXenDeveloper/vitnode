import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { StartSsoConnectionResult } from "./sso-connections-mutations";

export const useStartFailureToast = (providerName: string) => {
  const t = useTranslations("core.auth.settings.sso");
  const tErrors = useTranslations("core.global.errors");

  return (result: StartSsoConnectionResult): void => {
    if (result.ok) return;

    if (result.failure === "server_error") {
      toast.error(tErrors("title"), {
        description: tErrors("internal_server_error"),
      });

      return;
    }

    toast.error(t(`errors.${result.failure}.title`), {
      description: t(`errors.${result.failure}.desc`, {
        provider: providerName,
      }),
    });
  };
};
