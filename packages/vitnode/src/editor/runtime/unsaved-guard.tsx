import type { ReactElement } from "react";

import { useBlocker } from "@tanstack/react-router";
import { useTranslations } from "use-intl";

import { useBeforeUnload } from "@/hooks/use-before-unload";

import { useVisualEditor } from "../context";
import { LeaveConfirmDialog } from "./leave-confirm-dialog";

export const UnsavedChangesGuard = (): ReactElement => {
  const { dirty } = useVisualEditor();
  const t = useTranslations("core.editor");

  useBeforeUnload(dirty, t("unsaved"));

  const blocker = useBlocker({
    enableBeforeUnload: false,
    shouldBlockFn: () => dirty,
    withResolver: true,
  });

  return (
    <LeaveConfirmDialog
      onConfirm={() => blocker.proceed?.()}
      onOpenChange={open => {
        if (!open) blocker.reset?.();
      }}
      open={blocker.status === "blocked"}
    />
  );
};
