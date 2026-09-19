import type { ReactElement } from "react";

import { ChevronLeftIcon, XIcon } from "lucide-react";
import { Activity } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import { EDITOR_SHELL_STYLE } from "../../blocks/editor-shell";
import { useVisualEditor } from "../context";
import { EditorPropertiesPanel } from "../properties/panel";
import { AvailableBlocksPanel } from "./blocks-panel";
import { EditorSidebarFooter } from "./footer";
import { insertTargetScope } from "./insert-target";
import { EditorPreviewBar } from "./preview-bar";

const EditorSidebarPanels = (): ReactElement => {
  const { dispatch, insertTarget, panel, setInsertTarget } = useVisualEditor();
  const t = useTranslations("core.editor");
  const scope = insertTargetScope(insertTarget);

  return (
    <aside
      aria-label={t("title")}
      className="border-border bg-background fixed start-0 end-0 bottom-0 z-40 flex max-h-(--editor-sheet-height) flex-col border-t shadow-lg md:start-auto md:top-0 md:max-h-none md:w-(--editor-sidebar-width) md:border-s md:border-t-0 md:shadow-none"
      style={EDITOR_SHELL_STYLE}
    >
      <header className="border-border flex flex-col gap-2 border-b p-4">
        {panel === "blocks" ? (
          <h2 className="text-sm leading-none font-semibold text-balance">
            {t("available_blocks")}
          </h2>
        ) : (
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
        )}

        {panel === "blocks" && insertTarget !== null && scope !== null ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground min-w-0 truncate text-xs leading-relaxed">
              {scope === "area"
                ? t("insert_for_area", { zone: insertTarget.zoneId })
                : t("insert_for", { zone: insertTarget.zoneId })}
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
        <Activity mode={panel === "blocks" ? "visible" : "hidden"}>
          <AvailableBlocksPanel />
        </Activity>

        <Activity mode={panel === "blocks" ? "hidden" : "visible"}>
          <EditorPropertiesPanel />
        </Activity>
      </div>

      <EditorSidebarFooter />
    </aside>
  );
};

export const EditorSidebar = (): ReactElement => {
  const { preview } = useVisualEditor();

  return (
    <>
      <Activity mode={preview ? "hidden" : "visible"}>
        <EditorSidebarPanels />
      </Activity>

      <Activity mode={preview ? "visible" : "hidden"}>
        <EditorPreviewBar />
      </Activity>
    </>
  );
};
