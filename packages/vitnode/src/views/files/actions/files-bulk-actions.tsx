"use client";

import { Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { BulkDeleteFilesResult } from "@/lib/files/bulk-delete";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { useDataTableSelection } from "@/components/table/selection";
import { Button } from "@/components/ui/button";

import type { DeleteMyFiles } from "../my-files-delete";

export const MyFilesBulkActions = ({
  onDeleteFiles,
}: {
  onDeleteFiles: DeleteMyFiles;
}) => {
  const t = useTranslations("core.files");
  const tGlobal = useTranslations("core.global.errors");
  const { selected } = useDataTableSelection();
  const [heldByRevisions, setHeldByRevisions] = React.useState<number[]>([]);
  const isForcing = heldByRevisions.length > 0;
  const ids = isForcing ? heldByRevisions : selected;

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
        if (!open) setHeldByRevisions([]);
      }}
      onSubmit={async ({ onClose }) => {
        const result = await onDeleteFiles({ force: isForcing, ids });
        report(result);

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
