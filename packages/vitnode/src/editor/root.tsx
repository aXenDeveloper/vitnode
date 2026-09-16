import type { ReactElement, ReactNode } from "react";

import {
  createElement,
  useCallback,
  useMemo,
  useReducer,
  useState,
} from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { ContentEditRuntime } from "../blocks/edit-context";
import type { VisualEditorAdapter } from "./adapter/types";
import type {
  BlockPickerTarget,
  VisualEditorContextValue,
  VisualEditorSaveStatus,
} from "./context";

import { ContentEditContext } from "../blocks/edit-context";
import { buildSaveInput } from "./adapter/save-input";
import { BlockPickerDialog } from "./block-picker/dialog";
import { VisualEditorContext } from "./context";
import { EditorDndProvider } from "./dnd/provider";
import { BlockPropertiesPanel } from "./properties/panel";
import { EditorMessages } from "./runtime/editor-messages";
import { LeaveConfirmDialog } from "./runtime/leave-confirm-dialog";
import { UnsavedChangesGuard } from "./runtime/unsaved-guard";
import {
  initialVisualEditorState,
  isVisualEditorDirty,
  visualEditorReducer,
} from "./state/reducer";
import { EditorToolbar } from "./toolbar/toolbar";
import { EditableZone } from "./zones/editable-zone";

export interface EditorRootProps {
  adapter?: VisualEditorAdapter;
  children: ReactNode;
  onExit?: () => void;
}

const contentEditRuntime: ContentEditRuntime = {
  renderZone: mount => createElement(EditableZone, mount),
};

const EditorShell = ({
  adapter,
  children,
  onExit,
}: EditorRootProps): ReactElement => {
  const t = useTranslations("core.editor");
  const [state, dispatch] = useReducer(
    visualEditorReducer,
    initialVisualEditorState,
  );
  const [preview, setPreview] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<BlockPickerTarget | null>(
    null,
  );
  const [saveStatus, setSaveStatus] = useState<VisualEditorSaveStatus>("idle");
  const [leaving, setLeaving] = useState(false);

  const dirty = isVisualEditorDirty(state);

  const save = useCallback(() => {
    if (!adapter) {
      toast.error(t("no_adapter.title"), {
        description: t("no_adapter.desc"),
      });

      return;
    }

    const persist = async () => {
      try {
        await adapter.save(buildSaveInput(state));

        dispatch({ type: "saved" });
        setSaveStatus("saved");
        toast.success(t("saved_toast.title"), {
          description: t("saved_toast.desc"),
        });
      } catch {
        setSaveStatus("error");
        toast.error(t("save_error.title"), {
          description: t("save_error.desc"),
        });
      }
    };

    setSaveStatus("saving");
    void persist();
  }, [adapter, state, t]);

  const discard = useCallback(() => {
    dispatch({ type: "discard" });
    setSaveStatus("idle");
  }, []);

  const exit = useCallback(() => {
    if (dirty) {
      setLeaving(true);

      return;
    }

    onExit?.();
  }, [dirty, onExit]);

  const openPicker = useCallback(
    (target: BlockPickerTarget) => setPickerTarget(target),
    [],
  );

  const editor = useMemo<VisualEditorContextValue>(
    () => ({
      dirty,
      discard,
      dispatch,
      exit,
      openPicker,
      preview,
      save,
      saveStatus,
      setPreview,
      state,
    }),
    [dirty, discard, exit, openPicker, preview, save, saveStatus, state],
  );

  return (
    <VisualEditorContext value={editor}>
      <ContentEditContext value={contentEditRuntime}>
        <EditorDndProvider>
          {children}

          <EditorToolbar />
          <BlockPropertiesPanel />
          <BlockPickerDialog
            onOpenChange={open => {
              if (!open) setPickerTarget(null);
            }}
            open={pickerTarget !== null}
            target={pickerTarget}
          />
        </EditorDndProvider>
      </ContentEditContext>

      <UnsavedChangesGuard />
      <LeaveConfirmDialog
        onConfirm={() => {
          setLeaving(false);
          onExit?.();
        }}
        onOpenChange={setLeaving}
        open={leaving}
      />
    </VisualEditorContext>
  );
};

const EditorRoot = ({
  adapter,
  children,
  onExit,
}: EditorRootProps): ReactElement => (
  <EditorMessages>
    <EditorShell adapter={adapter} onExit={onExit}>
      {children}
    </EditorShell>
  </EditorMessages>
);

export default EditorRoot;
