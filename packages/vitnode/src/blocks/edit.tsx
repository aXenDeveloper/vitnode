import type { ReactElement, ReactNode } from "react";

import { lazy, Suspense, useCallback, useMemo, useState } from "react";

import type { VisualEditorAdapter } from "../editor/adapter/types";
import type {
  ContentEditRuntime,
  ContentZoneOutletEntry,
} from "./edit-context";
import type { ContentEditorShellMode } from "./editor-shell";

import { ContentEditContext, sameContentZoneMount } from "./edit-context";
import {
  EDITOR_SHELL_CLASS,
  EDITOR_SHELL_EDITING_CLASS,
  EDITOR_SHELL_IDLE_STYLE,
  EDITOR_SHELL_STYLE,
} from "./editor-shell";

const EditorRoot = lazy(async () => await import("../editor/root"));

export interface ContentEditorRuntimeProps {
  adapter?: VisualEditorAdapter;
  children: ReactNode;
  enabled: boolean;
  onExit?: () => void;
}

const NO_OUTLETS: readonly ContentZoneOutletEntry[] = [];

export const ContentEditorRuntime = ({
  adapter,
  children,
  enabled,
  onExit,
}: ContentEditorRuntimeProps): ReactElement => {
  const [outlets, setOutlets] =
    useState<readonly ContentZoneOutletEntry[]>(NO_OUTLETS);
  const [preview, setPreview] = useState(false);

  if (!enabled && preview) setPreview(false);

  const mode: ContentEditorShellMode | null = !enabled
    ? null
    : preview
      ? "preview"
      : "editing";

  const registerZone = useCallback((entry: ContentZoneOutletEntry) => {
    setOutlets(current => {
      const at = current.findIndex(open => open.mount.id === entry.mount.id);

      if (at === -1) return [...current, entry];
      if (
        current[at].node === entry.node &&
        sameContentZoneMount(current[at].mount, entry.mount)
      ) {
        return current;
      }

      return current.map((open, index) => (index === at ? entry : open));
    });
  }, []);

  const releaseZone = useCallback((id: string) => {
    setOutlets(current =>
      current.some(open => open.mount.id === id)
        ? current.filter(open => open.mount.id !== id)
        : current,
    );
  }, []);

  const runtime = useMemo<ContentEditRuntime | null>(
    () => (enabled ? { preview, registerZone, releaseZone } : null),
    [enabled, preview, registerZone, releaseZone],
  );

  return (
    <ContentEditContext value={runtime}>
      <div
        className={
          mode === "editing"
            ? `${EDITOR_SHELL_CLASS} ${EDITOR_SHELL_EDITING_CLASS}`
            : mode === "preview"
              ? EDITOR_SHELL_CLASS
              : undefined
        }
        style={mode === null ? EDITOR_SHELL_IDLE_STYLE : EDITOR_SHELL_STYLE}
      >
        {children}
      </div>

      {enabled ? (
        <Suspense fallback={null}>
          <EditorRoot
            adapter={adapter}
            onExit={onExit}
            outlets={outlets}
            preview={preview}
            setPreview={setPreview}
          />
        </Suspense>
      ) : null}
    </ContentEditContext>
  );
};

export type {
  ContentEditRuntime,
  ContentZoneMount,
  ContentZoneOutletEntry,
} from "./edit-context";
