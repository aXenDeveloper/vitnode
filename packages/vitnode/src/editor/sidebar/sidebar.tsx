import type { ReactElement } from "react";

import { ChevronLeftIcon, XIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import { EDITOR_SHELL_STYLE } from "../../blocks/editor-shell";
import { useVisualEditor } from "../context";
import { BlockPropertiesPanelContent } from "../properties/panel";
import { AvailableBlocksPanel } from "./blocks-panel";
import { EditorSidebarFooter } from "./footer";
import { EditorPreviewBar } from "./preview-bar";

export const EditorSidebar = (): ReactElement => {
  const { dispatch, insertTarget, panel, preview, setInsertTarget } =
    useVisualEditor();
  const t = useTranslations("core.editor");

  if (preview) return <EditorPreviewBar />;

  return (
    <aside
      aria-label={t("title")}
      className="border-border bg-background fixed start-0 end-0 bottom-0 z-40 flex max-h-(--editor-sheet-height) flex-col border-t shadow-lg md:start-auto md:top-0 md:max-h-none md:w-(--editor-sidebar-width) md:border-s md:border-t-0 md:shadow-none"
      style={EDITOR_SHELL_STYLE}
    >
      <header className="border-border flex flex-col gap-2 border-b p-4">
        {panel === "properties" ? (
          <Button
            className="self-start"
            onClick={() => {
              dispatch({ ref: null, type: "select" });
            }}
            size="sm"
            variant="ghost"
          >
            <ChevronLeftIcon className="rtl:rotate-180" />
            {t("available_blocks")}
          </Button>
        ) : (
          <h2 className="text-sm leading-none font-semibold text-balance">
            {t("available_blocks")}
          </h2>
        )}

        {panel === "blocks" && insertTarget !== null ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground min-w-0 truncate text-xs leading-relaxed">
              {t("insert_for", { zone: insertTarget.zoneId })}
            </span>

            <Button
              aria-label={t("insert_clear")}
              onClick={() => {
                setInsertTarget(null);
              }}
              size="icon-xs"
              variant="ghost"
            >
              <XIcon />
            </Button>
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {panel === "blocks" ? (
          <AvailableBlocksPanel />
        ) : (
          <BlockPropertiesPanelContent />
        )}
      </div>

      <EditorSidebarFooter />
    </aside>
  );
};
