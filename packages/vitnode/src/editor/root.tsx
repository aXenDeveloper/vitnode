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

import { ContentEditContext } from "../blocks/edit-context";
import { getDefaultBlockRegistry, isBlockAllowed } from "../blocks/registry";
import { buildInvalidSnapshot, buildSaveInput } from "./adapter/save-input";
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
  unsafeZoneIds,
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
  "--editor-sheet-height": "24rem",
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
  const [insertTarget, setInsertTarget] = useState<EditorInsertTarget | null>(
    null,
  );
  const [saveStatus, setSaveStatus] = useState<VisualEditorSaveStatus>("idle");
  const [leaving, setLeaving] = useState(false);

  const panel: EditorPanelMode =
    state.selectedBlockId === null ? "blocks" : "properties";
  const dirty = isVisualEditorDirty(state);
  const unsafe = useMemo(() => unsafeZoneIds(state), [state]);

  const setPanel = useCallback((mode: EditorPanelMode) => {
    if (mode === "blocks") {
      dispatch({ blockId: null, type: "select" });
    }
  }, []);

  const persist = useCallback(async (): Promise<boolean> => {
    if (!adapter) {
      toast.error(t("no_adapter.title"), {
        description: t("no_adapter.desc"),
      });

      return false;
    }

    if (unsafe.length > 0) {
      toast.error(t("unsafe.title"), { description: t("unsafe.desc") });

      return false;
    }

    const input = buildSaveInput(state);
    const invalid = buildInvalidSnapshot(state);
    setSaveStatus("saving");

    try {
      await adapter.save(input);
    } catch {
      setSaveStatus("error");
      toast.error(t("save_error.title"), {
        description: t("save_error.desc"),
      });

      return false;
    }

    dispatch({ invalid, snapshot: input.zones, type: "saved" });
    setSaveStatus("saved");
    toast.success(t("saved_toast.title"), {
      description: t("saved_toast.desc"),
    });

    return true;
  }, [adapter, state, t, unsafe]);

  const save = useCallback(() => {
    void persist();
  }, [persist]);

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
      setInsertTarget(null);
    },
    [insertTarget, state.order, state.zones],
  );

  const editor = useMemo<VisualEditorContextValue>(
    () => ({
      dirty,
      discard,
      dispatch,
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
      unsafeZoneIds: unsafe,
    }),
    [
      dirty,
      discard,
      exit,
      insertBlock,
      insertTarget,
      panel,
      preview,
      save,
      saveStatus,
      setPanel,
      state,
      unsafe,
    ],
  );

  return (
    <VisualEditorContext value={editor}>
      <ContentEditContext value={contentEditRuntime}>
        <EditorDndProvider>
          <div
            className={cn(
              "transition-[padding] duration-200 ease-linear",
              !preview &&
                "pb-(--editor-sheet-height) md:pe-(--editor-sidebar-width) md:pb-0",
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
        onSave={() => {
          void persist().then(saved => {
            if (!saved) return;

            setLeaving(false);
            onExit?.();
          });
        }}
        open={leaving}
        saveStatus={saveStatus}
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
