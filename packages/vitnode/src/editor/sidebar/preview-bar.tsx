import type { ReactElement } from "react";

import { LogOutIcon, PencilIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import { useVisualEditor } from "../context";

export const EditorPreviewBar = (): ReactElement => {
  const { exit, setPreview } = useVisualEditor();
  const t = useTranslations("core.editor");

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4">
      <nav
        aria-label={t("title")}
        className="border-border bg-background pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-lg border p-2 shadow-lg"
      >
        <Button
          onClick={() => {
            setPreview(false);
          }}
          size="sm"
          variant="secondary"
        >
          <PencilIcon />
          {t("back_to_editing")}
        </Button>

        <Button onClick={exit} size="sm">
          <LogOutIcon />
          {t("finish")}
        </Button>
      </nav>
    </div>
  );
};
