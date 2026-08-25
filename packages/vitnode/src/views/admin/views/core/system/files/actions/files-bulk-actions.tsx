"use client";

import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import type { BulkDeleteFilesResult } from "@/lib/files/bulk-delete";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { useDataTableSelection } from "@/components/table/selection";
import { Button } from "@/components/ui/button";

import { deleteFilesAction } from "./delete-action.server";

export const FilesBulkActions = () => {
  const t = useTranslations("admin.system.files");
  const tGlobal = useTranslations("core.global.errors");
  const { selected } = useDataTableSelection();
  // The ids the first pass could only have deleted by dropping their retained
  // revisions. Held rather than forced silently: forcing costs those revisions
  // their copy of the file, so the person has to be told how many first.
  const [heldByRevisions, setHeldByRevisions] = React.useState<number[]>([]);
  const isForcing = heldByRevisions.length > 0;
  const ids = isForcing ? heldByRevisions : selected;

  /**
   * Says what the pass did, per reason.
   *
   * A bulk delete can succeed and be refused at the same time, so this is
   * additive - a success toast next to a content refusal is the accurate
   * account, not a contradiction.
   */
  const report = (result: BulkDeleteFilesResult) => {
    if (result.deleted > 0) {
      toast.success(t("bulk_delete.success", { count: result.deleted }));
    }

    if (result.blockedByContent > 0) {
      toast.error(tGlobal("title"), {
        description: t("bulk_delete.in_use.content", {
          count: result.blockedByContent,
        }),
      });
    }

    if (result.failed > 0) {
      toast.error(tGlobal("title"), {
        description: tGlobal("internal_server_error"),
      });
    }
  };

  return (
    <ConfirmActionAlertDialog
      description={
        isForcing
          ? t("bulk_delete.in_use.revisions.desc", { count: ids.length })
          : t("bulk_delete.desc", { count: ids.length })
      }
      onOpenChange={open => {
        // A dialog that opens again starts from the plain confirmation: the
        // files may have been freed in the meantime, and asking to force
        // something that is no longer held is a lie about what is happening.
        if (!open) setHeldByRevisions([]);
      }}
      onSubmit={async ({ onClose }) => {
        const result = await deleteFilesAction({ force: isForcing, ids });
        report(result);

        // Only history is holding these: keep the dialog open, say what forcing
        // gives up, and let the same button do it.
        if (!isForcing && result.heldByRevisions.length > 0) {
          setHeldByRevisions(result.heldByRevisions);

          return;
        }

        onClose();
      }}
      textSubmit={
        isForcing
          ? t("bulk_delete.in_use.revisions.confirm")
          : t("bulk_delete.confirm")
      }
      title={t("bulk_delete.title", { count: ids.length })}
    >
      <Button size="sm" variant="destructive">
        <Trash2Icon />
        {t("actions.delete")}
      </Button>
    </ConfirmActionAlertDialog>
  );
};
