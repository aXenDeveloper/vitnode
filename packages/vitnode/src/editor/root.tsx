import type { CSSProperties, ReactElement, ReactNode } from "react";

import { cn } from "cn";
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
  EditorInsertRequest,
  EditorInsertTarget,
  EditorPanelMode,
  VisualEditorContextValue,
  VisualEditorSaveStatus,
} from "./context";
import type { VisualEditorAction } from "./state/types";

import { ContentEditContext } from "../blocks/edit-context";
import { getDefaultBlockRegistry, isBlockAllowed } from "../blocks/registry";
import { buildSaveInput } from "./adapter/save-input";
import { VisualEditorContext } from "./context";
import { EditorDndProvider } from "./dnd/provider";
import { createBlockInstanceFor } from "./instance/defaults";
import { EditorMessages } from "./runtime/editor-messages";
import { LeaveConfirmDialog } from "./runtime/leave-confirm-dialog";
import { UnsavedChangesGuard } from "./runtime/unsaved-guard";
import { EditorSidebar } from "./sidebar/sidebar";
import {
  initialVisualEditorState,
  isVisualEditorDirty,
  visualEditorReducer,
} from "./state/reducer";
import { EditableZone } from "./zones/editable-zone";

export interface EditorRootProps {
  adapter?: VisualEditorAdapter;
  children: ReactNode;
  onExit?: () => void;
}

const contentEditRuntime: ContentEditRuntime = {
  renderZone: mount => createElement(EditableZone, mount),
};

const EDITOR_SHELL_STYLE = {
  "--editor-sidebar-width": "clamp(20rem, 24vw, 22.5rem)",
} as CSSProperties;

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
  const [panel, setPanel] = useState<EditorPanelMode>("blocks");
  const [insertTarget, setInsertTarget] = useState<EditorInsertTarget | null>(
    null,
  );
  const [saveStatus, setSaveStatus] = useState<VisualEditorSaveStatus>("idle");
  const [leaving, setLeaving] = useState(false);

  const [syncedSelection, setSyncedSelection] = useState(state.selectedBlockId);
  if (syncedSelection !== state.selectedBlockId) {
    setSyncedSelection(state.selectedBlockId);
    setPanel(state.selectedBlockId === null ? "blocks" : "properties");
  }

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

  const dispatchAction = useCallback((action: VisualEditorAction) => {
    if (action.type === "select") {
      setPanel(action.blockId === null ? "blocks" : "properties");
    }

    dispatch(action);
  }, []);

  const insertBlock = useCallback(
    (request: EditorInsertRequest) => {
      const accepts = (candidate: string): boolean => {
        const zone = state.zones[candidate];
        if (!zone) return false;

        const registry = zone.registry ?? getDefaultBlockRegistry();
        if (!registry?.has(request.type)) return false;

        return (
          zone.allowedBlocks === undefined ||
          isBlockAllowed(zone.allowedBlocks, request.type)
        );
      };

      const zoneId =
        request.zoneId ??
        insertTarget?.zoneId ??
        state.order.find(candidate => accepts(candidate));
      if (zoneId === undefined || !accepts(zoneId)) return;

      const zone = state.zones[zoneId];
      const registry = zone.registry ?? getDefaultBlockRegistry();
      const entry = registry?.get(request.type);
      if (!entry) return;

      const pending = insertTarget?.zoneId === zoneId ? insertTarget : null;
      const instance = createBlockInstanceFor(entry);

      dispatch({
        index: request.index ?? pending?.index ?? zone.blocks.length,
        instance,
        type: "insert",
        zoneId,
      });
      dispatch({ blockId: instance.id, type: "select" });
      setPanel("properties");
      setInsertTarget(null);
    },
    [insertTarget, state.order, state.zones],
  );

  const editor = useMemo<VisualEditorContextValue>(
    () => ({
      dirty,
      discard,
      dispatch: dispatchAction,
      exit,
      insertBlock,
      insertTarget,
      panel,
      preview,
      save,
      saveStatus,
      setInsertTarget,
      setPanel,
      setPreview,
      state,
    }),
    [
      dirty,
      discard,
      dispatchAction,
      exit,
      insertBlock,
      insertTarget,
      panel,
      preview,
      save,
      saveStatus,
      state,
    ],
  );

  return (
    <VisualEditorContext value={editor}>
      <ContentEditContext value={contentEditRuntime}>
        <EditorDndProvider>
          <div
            className={cn(
              "transition-[padding] duration-200 ease-linear",
              !preview && "md:pe-(--editor-sidebar-width)",
            )}
            style={EDITOR_SHELL_STYLE}
          >
            {children}

            <EditorSidebar />
          </div>
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
