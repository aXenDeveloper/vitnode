import type { ReactElement, ReactNode } from "react";

import { useMemo } from "react";

import type { VisualEditorContextValue } from "./context";

import {
  VisualEditorActionsContext,
  VisualEditorContext,
  VisualEditorPreviewContext,
} from "./context";

export const VisualEditorProvider = ({
  children,
  value,
}: {
  children: ReactNode;
  value: VisualEditorContextValue;
}): ReactElement => {
  const { dispatch, preview, setInsertTarget, setPanel } = value;
  const actions = useMemo(
    () => ({ dispatch, setInsertTarget, setPanel }),
    [dispatch, setInsertTarget, setPanel],
  );

  return (
    <VisualEditorContext value={value}>
      <VisualEditorActionsContext value={actions}>
        <VisualEditorPreviewContext value={preview}>
          {children}
        </VisualEditorPreviewContext>
      </VisualEditorActionsContext>
    </VisualEditorContext>
  );
};
