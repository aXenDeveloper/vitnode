import type { ReactElement, ReactNode } from "react";

import { lazy, Suspense } from "react";

import type { VisualEditorAdapter } from "../editor/adapter/types";

const EditorRoot = lazy(async () => await import("../editor/root"));

export interface ContentEditorRuntimeProps {
  adapter?: VisualEditorAdapter;
  children: ReactNode;
  enabled: boolean;
  onExit?: () => void;
}

export const ContentEditorRuntime = ({
  adapter,
  children,
  enabled,
  onExit,
}: ContentEditorRuntimeProps): ReactElement => {
  if (!enabled) return <>{children}</>;

  return (
    <Suspense fallback={children}>
      <EditorRoot adapter={adapter} onExit={onExit}>
        {children}
      </EditorRoot>
    </Suspense>
  );
};

export type { ContentEditRuntime, ContentZoneMount } from "./edit-context";
