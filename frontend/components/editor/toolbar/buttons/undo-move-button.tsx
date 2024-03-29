import { useTranslations } from "next-intl";
import { Undo } from "lucide-react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  UNDO_COMMAND
} from "lexical";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export const UndoMoveButtonEditor = () => {
  const t = useTranslations("core.editor.move");
  const [editor] = useLexicalComposerContext();
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    return editor.registerCommand<boolean>(
      CAN_UNDO_COMMAND,
      payload => {
        setCanUndo(payload);

        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );
  }, [editor]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9"
      onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
      ariaLabel={t("undo")}
      disabled={!canUndo}
    >
      <Undo />
    </Button>
  );
};
