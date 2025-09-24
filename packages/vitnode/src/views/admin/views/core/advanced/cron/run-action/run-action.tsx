"use client";

import { PlayIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";

import { mutationApi } from "./mutation-api";

export const RunActionCronTable = ({ id }: { id: number }) => {
  const t = useTranslations("admin.advanced.cron.list.actions.runNow");
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

    toast.success(t("success"));
  }, null);

  return (
    <form action={formAction}>
      <TooltipWithContent text={t("label")}>
        <Button
          aria-label={t("label")}
          isLoading={isPending}
          size="icon"
          type="submit"
          variant="ghost"
        >
          <PlayIcon />
        </Button>
      </TooltipWithContent>
    </form>
  );
};
