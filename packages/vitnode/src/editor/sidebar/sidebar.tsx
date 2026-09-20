import type { ReactElement } from "react";

import { cn } from "cn";
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

/** Off-screen past the edge it is docked to: the bottom on a phone, the inline end above `md`. */
const SIDEBAR_CLOSED_CLASS =
  "translate-y-full md:translate-y-0 md:translate-x-full md:rtl:-translate-x-full";

/**
 * The same place, as the value the sidebar starts its very first transition from.
 *
 * `@starting-style` rather than a state flipped on the second frame: the browser
 * animates the entrance from markup alone, so nothing has to re-render to make
 * it happen and there is no frame where the sidebar sits over the page it has
 * not made room in yet.
 */
const SIDEBAR_OPEN_CLASS =
  "translate-x-0 translate-y-0 starting:translate-y-full md:starting:translate-y-0 md:starting:translate-x-full md:rtl:starting:-translate-x-full";

/**
 * How a panel arrives when the sidebar switches to it.
 *
 * `<Activity>` shows a panel by giving it a box again, and a CSS animation
 * replays every time that happens - so the panel that is arriving animates and
 * the one it replaced is simply gone, with nothing to keep mounted, no exit to
 * wait for and the panel's own scroll position and state untouched.
 *
 * Going deeper travels one way and coming back travels the other, which is what
 * makes the sidebar read as one surface being pushed along rather than two
 * screens being swapped.
 */
const PANEL_MOTION_CLASS =
  "animate-in fade-in duration-300 ease-out motion-reduce:animate-none";

const PANEL_FORWARD_CLASS = `${PANEL_MOTION_CLASS} slide-in-from-right-8 rtl:slide-in-from-left-8`;

const PANEL_BACK_CLASS = `${PANEL_MOTION_CLASS} slide-in-from-left-8 rtl:slide-in-from-right-8`;

const EditorSidebarPanels = ({
  closing,
}: {
  closing: boolean;
}): ReactElement => {
  const { dispatch, insertTarget, panel, setInsertTarget } = useVisualEditor();
  const t = useTranslations("core.editor");
  const scope = insertTargetScope(insertTarget);

  return (
    <aside
      aria-label={t("title")}
      className={cn(
        "border-border bg-background fixed start-0 end-0 bottom-0 z-40 flex max-h-(--editor-sheet-height) flex-col border-t shadow-lg transition-transform duration-200 ease-linear md:start-auto md:top-0 md:max-h-none md:w-(--editor-sidebar-width) md:border-s md:border-t-0 md:shadow-none",
        closing ? SIDEBAR_CLOSED_CLASS : SIDEBAR_OPEN_CLASS,
      )}
      style={EDITOR_SHELL_STYLE}
    >
      <header className="border-border flex flex-col gap-2 border-b p-4">
        {panel === "blocks" ? (
          <h2 className="flex h-8 items-center text-sm leading-none font-semibold text-balance">
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

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <Activity mode={panel === "blocks" ? "visible" : "hidden"}>
          <div className={PANEL_BACK_CLASS}>
            <AvailableBlocksPanel />
          </div>
        </Activity>

        <Activity mode={panel === "blocks" ? "hidden" : "visible"}>
          <div className={PANEL_FORWARD_CLASS}>
            <EditorPropertiesPanel />
          </div>
        </Activity>
      </div>

      <EditorSidebarFooter />
    </aside>
  );
};

export const EditorSidebar = ({
  closing,
  preview,
}: {
  closing: boolean;
  preview: boolean;
}): ReactElement => (
  <>
    <Activity mode={preview ? "hidden" : "visible"}>
      <EditorSidebarPanels closing={closing} />
    </Activity>

    <Activity mode={preview ? "visible" : "hidden"}>
      <EditorPreviewBar closing={closing} />
    </Activity>
  </>
);
