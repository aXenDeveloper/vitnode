import type { ReactElement, ReactNode } from "react";

import { useCallback, useMemo, useState } from "react";

import type { BlockInlineRuntime } from "../../blocks/inline-context";
import type { AnyBlockDefinition, AnyBlockInstance } from "../../blocks/types";
import type { EditorNodeRef } from "../state/types";
import type { EditorInlineBlockValue } from "./context";

import { BlockInlineContext } from "../../blocks/inline-context";
import { EditorInlineBlockContext } from "./context";
import { InlineEditableText } from "./editable-text";

const editableRuntime: BlockInlineRuntime = {
  render: ({ children, name, placeholder }) => (
    <InlineEditableText name={name} placeholder={placeholder}>
      {children}
    </InlineEditableText>
  ),
};

export interface EditorInlineBlockProps {
  children: ReactNode;
  definition: AnyBlockDefinition | undefined;
  instance: AnyBlockInstance;
  nodeRef: EditorNodeRef;
}

export const EditorInlineBlock = ({
  children,
  definition,
  instance,
  nodeRef,
}: EditorInlineBlockProps): ReactElement => {
  const { areaId, kind, nodeId, zoneId } = nodeRef;
  const [mountedFields, setMountedFields] = useState(0);

  const registerField = useCallback((): (() => void) => {
    setMountedFields(count => count + 1);
    let released = false;

    return () => {
      if (released) return;
      released = true;
      setMountedFields(count => (count > 0 ? count - 1 : 0));
    };
  }, []);

  const value = useMemo<EditorInlineBlockValue>(
    () => ({
      definition,
      hasInlineFields: mountedFields > 0,
      instance,
      nodeRef: { areaId, kind, nodeId, zoneId },
      registerField,
    }),
    [
      areaId,
      definition,
      instance,
      kind,
      mountedFields,
      nodeId,
      registerField,
      zoneId,
    ],
  );

  return (
    <EditorInlineBlockContext value={value}>
      <BlockInlineContext value={editableRuntime}>
        {children}
      </BlockInlineContext>
    </EditorInlineBlockContext>
  );
};
