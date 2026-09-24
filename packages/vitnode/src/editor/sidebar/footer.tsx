import type { ReactElement } from "react";

import { cn } from "cn";
import { EyeIcon, LogOutIcon, SaveIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";

import type { EditorStatus } from "./status";

import { useVisualEditor } from "../context";
import { zoneDisplayName } from "../zones/zone-name";
import { editorStatus } from "./status";

const STATUS_DOT_CLASSES = {
  failed: "bg-destructive",
  saved: "bg-success",
  saving: "bg-primary animate-pulse motion-reduce:animate-none",
  unsaved: "bg-warn",
} as const satisfies Record<EditorStatus, string>;

export const EditorSidebarFooter = (): ReactElement => {
  const {
    dirty,
    discard,
    dispatch,
    exit,
    preview,
    save,
    saveStatus,
    setPreview,
    state,
    unsafeZoneIds,
  } = useVisualEditor();
  const t = useTranslations("core.editor");
  const status = editorStatus(dirty, saveStatus);
  const statusLabels: Record<EditorStatus, string> = {
    failed: t("save_failed"),
    saved: t("saved"),
    saving: t("saving"),
    unsaved: t("unsaved"),
  };
  const saving = saveStatus === "saving";
  const blocked = unsafeZoneIds.length > 0;
  const dropped = state.droppedZoneIds;

  return (
    <footer className="border-border flex flex-col gap-3 border-t p-4">
      {dropped.length === 0 ? null : (
        <div
          className="border-destructive/30 bg-destructive/10 text-destructive flex flex-col items-start gap-2 rounded-lg border p-3"
          role="alert"
        >
          <p className="text-sm leading-relaxed text-pretty">
            {t("dropped.desc", {
              zones: dropped.map(zoneDisplayName).join(", "),
            })}
          </p>

          <Button
            onClick={() => {
              dispatch({ type: "dismiss-dropped" });
            }}
            size="sm"
            variant="ghost"
          >
            {t("dropped.dismiss")}
          </Button>
        </div>
      )}

      {blocked ? (
        <p
          className="text-destructive text-sm leading-relaxed text-pretty"
          role="alert"
        >
          {t("unsafe.desc")}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "flex min-w-0 items-center gap-2 text-sm leading-relaxed",
            status === "failed" ? "text-destructive" : "text-muted-foreground",
          )}
          role="status"
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-2 shrink-0 rounded-full transition-colors duration-150",
              STATUS_DOT_CLASSES[status],
            )}
          />
          <span className="truncate">{statusLabels[status]}</span>
        </p>

        <ConfirmActionAlertDialog
          description={t("discard_confirm")}
          onSubmit={({ onClose }) => {
            discard();
            onClose();
          }}
          submitVariant="destructive"
          textSubmit={t("discard")}
          title={t("discard")}
        >
          <Button
            className="-me-2.5"
            disabled={!dirty || saving}
            size="sm"
            variant="ghost"
          >
            {t("discard")}
          </Button>
        </ConfirmActionAlertDialog>
      </div>

      <div className="flex gap-2">
        <TooltipWithContent text={t("preview")}>
          <Button
            aria-label={t("preview")}
            aria-pressed={preview}
            onClick={() => {
              setPreview(!preview);
            }}
            size="icon"
            variant="outline"
          >
            <EyeIcon />
          </Button>
        </TooltipWithContent>

        <Button onClick={exit} variant="outline">
          <LogOutIcon />
          {t("finish")}
        </Button>

        <Button
          className="flex-1"
          disabled={!dirty || saving || blocked}
          isLoading={saving}
          onClick={save}
        >
          <SaveIcon />
          {t("save")}
        </Button>
      </div>
    </footer>
  );
};
