"use client";

import { PlayIcon } from "lucide-react";
import { useActionState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { Button } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { CONFIG_PLUGIN } from "@/config";

import type { RunCron } from "./run-cron";

export const RunActionCronTable = ({
  id,
  onRun,
}: {
  id: number;
  onRun: RunCron;
}) => {
  const t = useTranslations("admin.advanced.cron.list.actions.runNow");
  const tError = useTranslations("core.global.errors");
  const canRun = useAdminStaffPermission({
    plugin: CONFIG_PLUGIN.pluginId,
    module: "cron",
    permission: "can_run",
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, formAction, isPending] = useActionState(async () => {
    const mutation = await onRun(id);
    if (mutation?.error) {
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    toast.success(t("success"));
  }, null);

  if (!canRun) {
    return null;
  }

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
