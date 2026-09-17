import type { ReactElement } from "react";

import { useCallback, useMemo, useReducer, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { ContentZoneOutletEntry } from "../blocks/edit-context";
import type { VisualEditorAdapter } from "./adapter/types";
import type {
  EditorInsertAreaRequest,
  EditorInsertRequest,
  EditorInsertTarget,
  EditorPanelMode,
  VisualEditorContextValue,
  VisualEditorSaveStatus,
} from "./context";
import type { EditorContainerRef, VisualEditorSnapshot } from "./state/types";

import { createAreaInstance } from "../blocks/area";
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
  containerNodes,
  findNode,
  initialVisualEditorState,
  isVisualEditorDirty,
  unsafeZoneIds,
  visualEditorReducer,
} from "./state/reducer";
import { EditableZone } from "./zones/editable-zone";

export interface EditorRootProps {
  adapter?: VisualEditorAdapter;
  onExit?: () => void;
  outlets: readonly ContentZoneOutletEntry[];
  preview: boolean;
  setPreview: (preview: boolean) => void;
}

const EditorShell = ({
  adapter,
  onExit,
  outlets,
  preview,
  setPreview,
}: EditorRootProps): ReactElement => {
  const t = useTranslations("core.editor");
  const [state, dispatch] = useReducer(
    visualEditorReducer,
    initialVisualEditorState,
  );
  const [insertTarget, setInsertTarget] = useState<EditorInsertTarget | null>(
    null,
  );
  const [saveStatus, setSaveStatus] = useState<VisualEditorSaveStatus>("idle");
  const [leaving, setLeaving] = useState(false);

  if (
    insertTarget !== null &&
    (!(insertTarget.zoneId in state.zones) ||
      containerNodes(state, insertTarget) === null)
  ) {
    setInsertTarget(null);
  }

  const selected = state.selected;
  const panel: EditorPanelMode =
    selected === null || findNode(state, selected) === null
      ? "blocks"
      : selected.kind === "area"
        ? "area"
        : "properties";
  const dirty = isVisualEditorDirty(state);
  const unsafe = useMemo(() => unsafeZoneIds(state), [state]);

  const setPanel = useCallback(() => {
    dispatch({ ref: null, type: "select" });
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

    let canonical: undefined | VisualEditorSnapshot;

    try {
      canonical = (await adapter.save(input))?.zones;
    } catch {
      setSaveStatus("error");
      toast.error(t("save_error.title"), {
        description: t("save_error.desc"),
      });

      return false;
    }

    dispatch({ canonical, invalid, snapshot: input.zones, type: "saved" });
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
      const areaId =
        request.areaId === undefined
          ? (pending?.areaId ?? null)
          : request.areaId;
      const container: EditorContainerRef = { areaId, zoneId };
      const nodes = containerNodes(state, container);
      if (nodes === null) return;

      const instance = createBlockInstanceFor(entry);

      dispatch({
        container,
        index: request.index ?? pending?.index ?? nodes.length,
        instance,
        type: "insert",
      });
      dispatch({
        ref: { areaId, kind: "block", nodeId: instance.id, zoneId },
        type: "select",
      });
      setInsertTarget(null);
    },
    [insertTarget, state],
  );

  const insertArea = useCallback(
    (request: EditorInsertAreaRequest = {}) => {
      const zoneId = request.zoneId ?? insertTarget?.zoneId ?? state.order[0];
      const zone = zoneId === undefined ? undefined : state.zones[zoneId];
      if (zoneId === undefined || !zone) return;

      const pending = insertTarget?.zoneId === zoneId ? insertTarget : null;
      if (pending !== null && pending.areaId !== null) return;

      const area = createAreaInstance();

      dispatch({
        area,
        index: request.index ?? pending?.index ?? zone.nodes.length,
        type: "insert-area",
        zoneId,
      });
      dispatch({
        ref: { areaId: null, kind: "area", nodeId: area.id, zoneId },
        type: "select",
      });
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
      insertArea,
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
      insertArea,
      insertBlock,
      insertTarget,
      panel,
      preview,
      save,
      saveStatus,
      setPanel,
      setPreview,
      state,
      unsafe,
    ],
  );

  return (
    <VisualEditorContext value={editor}>
      <EditorDndProvider>
        {outlets.map(outlet =>
          createPortal(
            <EditableZone mount={outlet.mount} />,
            outlet.node,
            outlet.mount.id,
          ),
        )}

        <EditorSidebar />
      </EditorDndProvider>

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

const EditorRoot = (props: EditorRootProps): ReactElement => (
  <EditorMessages>
    <EditorShell {...props} />
  </EditorMessages>
);

export default EditorRoot;
