import type { ReactElement } from "react";

import { useTranslations } from "use-intl";

import type { EditorDropEdge } from "../dnd/resolve-drop";

import { useEditorDnd } from "../dnd/context";

const MIN_SLOT_HEIGHT = 96;

export const EditorDropSlot = ({
  areaId,
  edge,
  nodeId,
  zoneId,
}: {
  areaId: null | string;
  edge: EditorDropEdge;
  nodeId: string;
  zoneId: string;
}): null | ReactElement => {
  const t = useTranslations("core.editor.dnd");
  const { dragHeight, dropSlot, slotLabel } = useEditorDnd();

  if (
    dropSlot === null ||
    dropSlot.nodeId !== nodeId ||
    dropSlot.edge !== edge ||
    dropSlot.zoneId !== zoneId ||
    dropSlot.areaId !== areaId
  ) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="border-primary bg-primary/10 text-primary animate-in fade-in zoom-in-98 my-2 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center duration-150 motion-reduce:animate-none"
      data-editor-drop-slot
      style={{ height: Math.max(dragHeight, MIN_SLOT_HEIGHT) }}
    >
      {slotLabel === null ? null : (
        <>
          <span className="[&_svg]:size-5">{slotLabel.icon}</span>
          <p className="text-sm leading-relaxed font-medium text-balance">
            {t("drop_slot", { name: slotLabel.name })}
          </p>
        </>
      )}
    </div>
  );
};
