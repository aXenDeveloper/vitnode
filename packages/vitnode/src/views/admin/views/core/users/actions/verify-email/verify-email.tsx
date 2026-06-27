"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";

import { mutationApi } from "./mutation-api";

export const VerifyEmailUserAdmin = ({
  id,
  emailVerified,
  iconOnly = false,
}: {
  emailVerified: boolean;
  iconOnly?: boolean;
  id: number;
}) => {
  const t = useTranslations("admin.user.verify_email");
  const tError = useTranslations("core.global.errors");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, formAction, isPending] = useActionState(async () => {
    const mutation = await mutationApi(id);

    if (mutation?.error) {
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    toast.success(t("success"), {
      description: mutation.data?.name,
    });
  }, null);

  if (emailVerified) {
    return null;
  }

  return (
    <form action={formAction}>
      {iconOnly ? (
        <TooltipWithContent text={t("label")}>
          <Button
            aria-label={t("label")}
            isLoading={isPending}
            size="icon"
            type="submit"
          >
            <CheckIcon />
          </Button>
        </TooltipWithContent>
      ) : (
        <Button isLoading={isPending} type="submit">
          <CheckIcon />
          {t("label")}
        </Button>
      )}
    </form>
  );
};
