"use client";

import { LogOutIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";

import type { RevokeDevice } from "./devices-revoke";

/**
 * Signing one device out, as a button both frameworks render.
 *
 * What used to make this Next.js-only was one import: the server action, which
 * ends in `revalidatePath` and drags `next/headers` and the whole API module
 * graph behind it. It is a prop now - `onRevoke` - so the Next.js page passes
 * the action and the TanStack Start route passes a browser fetch that ends in a
 * query invalidation, and everything visible here is the same in both.
 *
 * `useTranslations` from `use-intl` rather than from `next-intl`, for the same
 * reason: `next-intl`'s root entry re-exports these APIs and is framework-free,
 * but naming it here would be one more thing a non-Next app has to happen to
 * resolve. The strings come from whichever provider is above - `I18nProvider` in
 * Next.js, `RouteMessages` in TanStack Start - and both mount `core.global`
 * alongside `core.auth.settings`, which is what the confirm dialog's own buttons
 * need.
 *
 * The result is *reported*, never thrown. `onRevoke` returns a closed
 * `RevokeDeviceResult` in both applications, so this component's whole error
 * handling is one branch, and it stays identical whether the failure was a
 * refused status or a server that was not listening.
 */
export const RevokeDeviceButton = ({
  onRevoke,
  os,
  publicId,
}: {
  onRevoke: RevokeDevice;
  os: string;
  publicId: string;
}) => {
  const t = useTranslations("core.auth.settings.devices.revoke");
  const tGlobal = useTranslations("core.global.errors");

  return (
    <ConfirmActionAlertDialog
      description={t("desc", { os })}
      onSubmit={async ({ onClose }) => {
        const result = await onRevoke({ publicId });

        if (result.error) {
          toast.error(tGlobal("title"), {
            description: tGlobal("internal_server_error"),
          });

          return;
        }

        toast.success(t("success"));
        onClose();
      }}
      textSubmit={t("confirm")}
      title={t("title")}
    >
      <Button aria-label={t("action")} size="icon-sm" variant="destructive">
        <LogOutIcon />
      </Button>
    </ConfirmActionAlertDialog>
  );
};
