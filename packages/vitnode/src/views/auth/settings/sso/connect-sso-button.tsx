import { LinkIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import type { StartSsoConnection } from "./sso-connections-mutations";

import { useStartFailureToast } from "./sso-start-feedback";

export const ConnectSsoButton = ({
  onStart,
  providerId,
  providerName,
}: {
  onStart: StartSsoConnection;
  providerId: string;
  providerName: string;
}) => {
  const t = useTranslations("core.auth.settings.sso");
  const showFailure = useStartFailureToast(providerName);
  const [isPending, setIsPending] = React.useState(false);

  return (
    <Button
      aria-label={t("connect.aria", { provider: providerName })}
      isLoading={isPending}
      onClick={async () => {
        setIsPending(true);
        const result = await onStart({ intent: "link", providerId });

        if (!result.ok) {
          setIsPending(false);
          showFailure(result);
        }
      }}
      size="sm"
    >
      <LinkIcon aria-hidden="true" />
      {t("connect.action")}
    </Button>
  );
};
