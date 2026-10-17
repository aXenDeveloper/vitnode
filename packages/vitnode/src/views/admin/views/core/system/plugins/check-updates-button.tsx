import { useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { useActionState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { Button } from "@/components/ui/button";
import { manifest } from "@/manifest";

import type { CheckPluginUpdates } from "./plugin-updates-query";

import { pluginUpdatesQueryKey } from "./plugin-updates-query";

export const CheckUpdatesButton = ({
  onCheck,
  retry = false,
}: {
  onCheck: CheckPluginUpdates;
  retry?: boolean;
}) => {
  const t = useTranslations("admin.system.plugins.updates.check");
  const queryClient = useQueryClient();
  const canCheck = useAdminStaffPermission({
    plugin: manifest.id,
    module: "plugins",
    permission: "can_check_updates",
  });
  const [, formAction, isPending] = useActionState(async () => {
    const result = await onCheck();

    switch (result.status) {
      case "completed":
        await queryClient.invalidateQueries({
          queryKey: pluginUpdatesQueryKey,
        });
        if (result.failedSources > 0) {
          toast.warning(t("partial.title"), {
            description: t("partial.desc", { count: result.failedSources }),
          });
        } else {
          toast.success(t("success.title"), {
            description: t("success.desc", {
              securityUpdates: result.securityUpdates,
              updates: result.updates,
            }),
          });
        }

        return;
      case "cooldown":
        toast.info(t("cooldown.title"), {
          description: t("cooldown.desc", {
            seconds: result.retryAfterSeconds ?? 60,
          }),
        });

        return;
      case "disabled":
        toast.error(t("disabled.title"), { description: t("disabled.desc") });

        return;
      case "running":
        await queryClient.invalidateQueries({
          queryKey: pluginUpdatesQueryKey,
        });
        toast.info(t("running.title"), { description: t("running.desc") });

        return;
      case "error":
        toast.error(t("error.title"), { description: t("error.desc") });
    }
  }, null);

  if (!canCheck) return null;

  return (
    <form action={formAction}>
      <Button isLoading={isPending} type="submit" variant="outline">
        <RefreshCwIcon aria-hidden />
        {retry ? t("retry") : t("button")}
      </Button>
    </form>
  );
};
