import type { ReactElement } from "react";

import {
  EyeIcon,
  LogOutIcon,
  PencilIcon,
  SaveIcon,
  Undo2Icon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import type { VisualEditorSaveStatus } from "../context";

import { ConfirmActionAlertDialog } from "../../components/confirm-action/confirm-action-alert-dialog";
import { Button } from "../../components/ui/button";
import { useVisualEditor } from "../context";

type EditorStatus = "error" | "idle" | "saved" | "saving" | "unsaved";

const editorStatus = (
  dirty: boolean,
  saveStatus: VisualEditorSaveStatus,
): EditorStatus => {
  if (saveStatus === "saving") return "saving";
  if (saveStatus === "error") return "error";
  if (dirty) return "unsaved";

  return saveStatus === "saved" ? "saved" : "idle";
};

export const EditorToolbar = (): ReactElement => {
  const { dirty, discard, exit, preview, save, saveStatus, setPreview } =
    useVisualEditor();
  const t = useTranslations("core.editor");
  const status = editorStatus(dirty, saveStatus);
  const statusLabels: Record<EditorStatus, string> = {
    error: t("error"),
    idle: t("idle"),
    saved: t("saved"),
    saving: t("saving"),
    unsaved: t("unsaved"),
  };
  const saving = saveStatus === "saving";
  const previewLabel = preview ? t("edit") : t("preview");

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
      <nav
        aria-label={t("title")}
        className="border-border bg-background pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-lg border p-2 shadow-lg"
      >
        <div className="flex flex-col gap-1 px-2">
          <span className="text-sm leading-none font-medium">{t("title")}</span>
          <span
            className={
              status === "error"
                ? "text-destructive text-xs leading-none"
                : "text-muted-foreground text-xs leading-none"
            }
            role="status"
          >
            {statusLabels[status]}
          </span>
        </div>

        <Button
          aria-label={previewLabel}
          aria-pressed={preview}
          onClick={() => {
            setPreview(!preview);
          }}
          size="sm"
          variant={preview ? "secondary" : "ghost"}
        >
          {preview ? <PencilIcon /> : <EyeIcon />}
          <span className="hidden sm:inline">{previewLabel}</span>
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
          <Button
            aria-label={t("discard")}
            disabled={!dirty}
            size="sm"
            variant="ghost"
          >
            <Undo2Icon />
            <span className="hidden sm:inline">{t("discard")}</span>
          </Button>
        </ConfirmActionAlertDialog>

        <Button
          aria-label={t("save")}
          disabled={!dirty || saving}
          isLoading={saving}
          onClick={save}
          size="sm"
        >
          <SaveIcon />
          <span className="hidden sm:inline">{t("save")}</span>
        </Button>

        <Button
          aria-label={t("exit")}
          onClick={exit}
          size="icon-sm"
          variant="ghost"
        >
          <LogOutIcon />
        </Button>
      </nav>
    </div>
  );
};
