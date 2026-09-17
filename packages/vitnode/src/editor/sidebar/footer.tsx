import type { ReactElement } from "react";

import { cn } from "cn";
import { EyeIcon, LogOutIcon, SaveIcon, Undo2Icon } from "lucide-react";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";

import type { EditorStatus } from "./status";

import { useVisualEditor } from "../context";
import { editorStatus } from "./status";

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
          className="border-destructive/40 bg-destructive/10 text-destructive flex flex-col items-start gap-2 rounded-md border p-3"
          role="alert"
        >
          <p className="text-sm leading-relaxed text-pretty">
            {t("dropped.desc", { zones: dropped.join(", ") })}
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

      <p
        className={cn(
          "text-sm leading-relaxed",
          status === "failed" ? "text-destructive" : "text-muted-foreground",
        )}
        role="status"
      >
        {statusLabels[status]}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Button
          aria-pressed={preview}
          onClick={() => {
            setPreview(!preview);
          }}
          size="sm"
          variant="outline"
        >
          <EyeIcon />
          {t("preview")}
        </Button>

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
          <Button disabled={!dirty || saving} size="sm" variant="ghost">
            <Undo2Icon />
            {t("discard")}
          </Button>
        </ConfirmActionAlertDialog>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          disabled={!dirty || saving || blocked}
          isLoading={saving}
          onClick={save}
          variant="secondary"
        >
          <SaveIcon />
          {t("save")}
        </Button>

        <Button onClick={exit}>
          <LogOutIcon />
          {t("finish")}
        </Button>
      </div>
    </footer>
  );
};
