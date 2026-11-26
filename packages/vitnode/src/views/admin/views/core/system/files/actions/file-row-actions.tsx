import type { FileInUse } from "@vitnode/api/lib/files/in-use";

import { coreStaffPermissions } from "@vitnode/api/lib/core-staff-permissions";
import { manifest } from "@vitnode/api/manifest";
import {
  CaptionsIcon,
  DownloadIcon,
  LoaderCircleIcon,
  Trash2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { FilePreview } from "@/components/files/file-preview";
import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { fetcherClient } from "@/lib/fetcher-client";
import { FormFieldsPendingSkeleton } from "@/tanstack/pending/shapes";

import type { DeleteAdminFile } from "../files-delete";
import type { AdminFileRow } from "../files-query";

const FileAltContent = React.lazy(async () =>
  import("../alt/file-alt-content").then(module => ({
    default: module.FileAltContent,
  })),
);

const FILES_EDIT_ALT = coreStaffPermissions.admin.files.canEditAlt;

const fileFacts = (file: AdminFileRow) =>
  [
    file.name,
    file.dimensions
      ? `${file.dimensions.width}×${file.dimensions.height}`
      : null,
    file.mimeType?.replace("image/", "").toUpperCase(),
    file.folder,
  ]
    .filter(Boolean)
    .join(" · ");

const EditAltAction = ({ file }: { file: AdminFileRow }) => {
  const t = useTranslations("admin.system.files.alt");
  const canEdit = useAdminStaffPermission(FILES_EDIT_ALT);
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <TooltipWithContent text={t("open")}>
        <SheetTrigger
          render={
            <Button aria-label={t("open")} size="icon-sm" variant="ghost" />
          }
        >
          <CaptionsIcon />
        </SheetTrigger>
      </TooltipWithContent>
      <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-sm">
        <SheetHeader className="flex-row items-center gap-3">
          <FilePreview
            mimeType={file.mimeType}
            name={file.name}
            url={file.url}
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <SheetTitle className="truncate">{t("title")}</SheetTitle>
            <SheetDescription className="truncate text-xs">
              {fileFacts(file)}
            </SheetDescription>
          </div>
        </SheetHeader>
        <React.Suspense
          fallback={
            <FormFieldsPendingSkeleton
              className="p-4"
              footer="sheet"
              rows={2}
            />
          }
        >
          <FileAltContent
            canEdit={canEdit}
            fileId={file.id}
            fileName={file.name}
            onSaved={() => {
              setOpen(false);
            }}
          />
        </React.Suspense>
      </SheetContent>
    </Sheet>
  );
};

export const FileRowActions = ({
  canDelete,
  canDownload,
  file,
  onDelete,
}: {
  canDelete: boolean;
  canDownload: boolean;
  file: AdminFileRow;
  onDelete: DeleteAdminFile;
}) => {
  const { id, mimeType, name } = file;
  const t = useTranslations("admin.system.files");
  const tGlobal = useTranslations("core.global.errors");
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [heldByRevisions, setHeldByRevisions] =
    React.useState<FileInUse | null>(null);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await fetcherClient({
        plugin: manifest.id,
        module: "admin/files",
        path: "/{id}/download",
        method: "get",
        args: { params: { id: String(id) }, query: {} },
        options: { credentials: "include" },
      });
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = name;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error(tGlobal("title"), {
        description: t("download.error"),
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const isImage = mimeType?.startsWith("image/") ?? false;

  if (!canDownload && !canDelete && !isImage) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {isImage ? <EditAltAction file={file} /> : null}

      {canDownload && (
        <TooltipWithContent text={t("actions.download")}>
          <Button
            aria-label={t("actions.download")}
            disabled={isDownloading}
            onClick={handleDownload}
            size="icon-sm"
            variant="ghost"
          >
            {isDownloading ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <DownloadIcon />
            )}
          </Button>
        </TooltipWithContent>
      )}

      {canDelete && (
        <ConfirmActionAlertDialog
          description={
            heldByRevisions
              ? t("delete.in_use.revisions.desc", {
                  count: heldByRevisions.revisions,
                })
              : t("delete.desc")
          }
          icon={<Trash2Icon />}
          onOpenChange={open => {
            if (!open) setHeldByRevisions(null);
          }}
          onSubmit={async ({ onClose }) => {
            const result = await onDelete({
              force: heldByRevisions !== null,
              id,
            });
            if (result.error) {
              const { inUse } = result.error;

              if (inUse && !inUse.content && inUse.revisions > 0) {
                setHeldByRevisions(inUse);

                return;
              }

              toast.error(tGlobal("title"), {
                description: inUse
                  ? t("delete.in_use.content")
                  : tGlobal("internal_server_error"),
              });

              return;
            }

            toast.success(t("delete.success"));
            onClose();
          }}
          textSubmit={
            heldByRevisions
              ? t("delete.in_use.revisions.confirm")
              : t("delete.confirm")
          }
          title={t("delete.title")}
        >
          <Button
            aria-label={t("actions.delete")}
            size="icon-sm"
            variant="destructive"
          >
            <Trash2Icon />
          </Button>
        </ConfirmActionAlertDialog>
      )}
    </div>
  );
};
