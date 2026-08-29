"use client";

import { BrushCleaningIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * "Clear the cache", in the debug panel's header.
 *
 * `onClearCache` is the whole of the framework difference, and this is the one
 * action on Wave 1 that does not end at an API call - there is no clear-cache
 * endpoint, because the thing being cleared is the *frontend's* cache:
 *
 *     Next.js         revalidatePath("/", "layout") in a server action
 *     TanStack Start  invalidate every query, then invalidate the router
 *
 * Both mean "everything you are holding is stale, read it again". Neither is a
 * server-side purge, and the button has never claimed to be one.
 *
 * It rejects rather than returning an error, which is why the caller is wrapped
 * in a `try`: the Next.js server action throws `Forbidden` for an administrator
 * without `debug.can_clear_cache`, and that shape is kept so the two behave
 * identically. The gate around this button hides it from them in the first
 * place - the throw is the boundary behind the gate.
 */
export const ClearCacheAction = ({
  onClearCache,
}: {
  onClearCache: () => Promise<void>;
}) => {
  const t = useTranslations("admin.debug.actions.clear_cache");
  const tErrors = useTranslations("core.global.errors");

  return (
    <ConfirmActionAlertDialog
      description={t("desc")}
      onSubmit={async ({ onClose }) => {
        try {
          await onClearCache();
        } catch {
          toast.error(tErrors("title"), {
            description: tErrors("internal_server_error"),
          });

          return;
        }

        onClose();
        toast.success(t("success"));
      }}
      textSubmit={t("confirm")}
      title={t("title")}
    >
      <Button>
        <BrushCleaningIcon />
        {t("label")}
      </Button>
    </ConfirmActionAlertDialog>
  );
};
