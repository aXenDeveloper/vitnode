import type { Editor } from "@tiptap/react";

import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { GripVerticalIcon } from "lucide-react";
import { useTranslations } from "use-intl";

export const TipTapDragHandle = ({ editor }: { editor: Editor }) => {
  const t = useTranslations("core.global.editor");

  return (
    <DragHandle className="z-10" editor={editor} nested>
      <span
        aria-hidden="true"
        className="text-muted-foreground hover:bg-accent hover:text-foreground me-0.5 flex h-6 w-4 cursor-grab items-center justify-center rounded-sm active:cursor-grabbing"
        title={t("drag_handle")}
      >
        <GripVerticalIcon className="size-4" />
      </span>
    </DragHandle>
  );
};
