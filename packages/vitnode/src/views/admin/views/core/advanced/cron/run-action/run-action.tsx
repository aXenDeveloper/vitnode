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

/**
 * The "run now" button on a cron row.
 *
 * `onRun` is the one thing it cannot decide for itself: in Next.js the run ends
 * in `revalidatePath` and so has to be a server action, and in TanStack Start it
 * is a browser call followed by a query invalidation. Both are
 * `(id) => Promise<RunCronResult>`, so the button takes one and stops caring -
 * see `run-cron.ts`.
 *
 * The permission check is unchanged and stays here rather than moving to the
 * caller: the table renders one of these per row, and hiding the control is the
 * AdminCP's established way of saying "not yours". It is a rendering decision -
 * the API re-checks `cron.can_run` on the request itself.
 */
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
