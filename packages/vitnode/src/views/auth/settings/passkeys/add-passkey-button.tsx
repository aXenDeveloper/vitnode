import { PlusIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import type { AddPasskey } from "./passkeys-mutations";

export const AddPasskeyButton = ({
  describedBy,
  isSupported,
  onAdd,
}: {
  describedBy?: string;
  isSupported: boolean;
  onAdd: AddPasskey;
}) => {
  const t = useTranslations("core.auth.settings.passkeys");
  const tErrors = useTranslations("core.global.errors");
  const [isPending, setIsPending] = React.useState(false);

  const onClick = async () => {
    setIsPending(true);

    try {
      const result = await onAdd();

      if (result.ok) {
        toast.success(t("add_success.title"), {
          description: t("add_success.desc", { name: result.passkey.name }),
        });

        return;
      }

      if (result.failure === "cancelled") {
        toast.info(t("errors.cancelled.title"), {
          description: t("errors.cancelled.desc"),
        });

        return;
      }

      if (result.failure === "server_error") {
        toast.error(tErrors("title"), {
          description: tErrors("internal_server_error"),
        });

        return;
      }

      toast.error(t(`errors.${result.failure}.title`), {
        description: t(`errors.${result.failure}.desc`),
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      aria-describedby={describedBy}
      disabled={!isSupported || isPending}
      isLoading={isPending}
      onClick={onClick}
      type="button"
      variant="outline"
    >
      <PlusIcon aria-hidden="true" />
      {t("add")}
    </Button>
  );
};
