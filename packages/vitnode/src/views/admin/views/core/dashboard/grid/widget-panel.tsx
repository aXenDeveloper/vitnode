import { useDraggable } from "@dnd-kit/core";
import { cn } from "cn";
import { GripVerticalIcon, LayoutGridIcon, SearchIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInput,
} from "@/components/ui/sidebar";

import type { DashboardWidgetOption } from "../widgets/types";

import { groupWidgets } from "./group-widgets";
import { panelDraggableId } from "./panel-drag-id";

export const WIDGET_OPTION_CARD_CLASS =
  "border-border bg-card text-card-foreground flex w-full items-center gap-3 rounded-lg border p-2 text-start";

export const WidgetOptionCardBody = ({
  widget,
}: {
  widget: DashboardWidgetOption;
}) => (
  <>
    <span
      aria-hidden="true"
      className="bg-muted text-muted-foreground group-hover/option:bg-primary/10 group-hover/option:text-primary flex size-9 shrink-0 items-center justify-center rounded-sm transition-colors duration-150 [&_svg]:size-4"
    >
      {widget.icon ?? <LayoutGridIcon />}
    </span>

    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm leading-relaxed font-medium">
        {widget.title}
      </span>

      {widget.desc ? (
        <span className="text-muted-foreground line-clamp-2 text-xs leading-relaxed text-pretty">
          {widget.desc}
        </span>
      ) : null}
    </span>
  </>
);

const PanelItem = ({
  onAdd,
  widget,
}: {
  onAdd: (widget: DashboardWidgetOption) => void;
  widget: DashboardWidgetOption;
}) => {
  const t = useTranslations("admin.dashboard.widgets");
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: panelDraggableId(widget.id),
    data: { fromPanel: true, widget },
  });
  const { onKeyDown: _keyboardActivator, ...pointerListeners } =
    listeners ?? {};

  return (
    <li>
      <button
        {...attributes}
        {...pointerListeners}
        aria-label={t("panel.add", { title: widget.title })}
        className={cn(
          WIDGET_OPTION_CARD_CLASS,
          "group/option focus-visible:border-ring focus-visible:ring-ring/50 hover:border-input hover:bg-muted/40 cursor-grab transition-[background-color,border-color,opacity] duration-150 ease-out outline-none select-none focus-visible:ring-3 active:cursor-grabbing motion-reduce:transition-none",
          isDragging && "border-primary/50 border-dashed opacity-50",
        )}
        onClick={() => {
          onAdd(widget);
        }}
        ref={setNodeRef}
        type="button"
      >
        <WidgetOptionCardBody widget={widget} />
        <GripVerticalIcon
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity duration-150 group-hover/option:opacity-100 group-focus-visible/option:opacity-100"
        />
      </button>
    </li>
  );
};

const PANEL_MOTION_CLASS =
  "animate-in fade-in duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none";

export const WidgetPanel = ({
  actions,
  isOpen,
  onAdd,
  properties,
  widgets,
}: {
  actions?: React.ReactNode;
  isOpen: boolean;
  onAdd: (widget: DashboardWidgetOption) => void;
  properties?: React.ReactNode;
  widgets: DashboardWidgetOption[];
}) => {
  const t = useTranslations("admin.dashboard.widgets");
  const [query, setQuery] = React.useState("");

  const [wasOpen, setWasOpen] = React.useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setQuery("");
  }

  const groups = groupWidgets({ query, widgets });

  return (
    <div
      aria-hidden={!isOpen}
      className={cn(
        "mt-4 flex w-full",
        !isOpen && "hidden",
        "motion-reduce:transition-none md:fixed md:inset-e-0 md:top-16 md:bottom-0 md:z-10 md:mt-0 md:flex md:w-(--dashboard-panel-width) md:transition-transform md:duration-200 md:ease-[cubic-bezier(0.32,0.72,0,1)]",
        !isOpen && "md:translate-x-full md:rtl:-translate-x-full",
      )}
      inert={!isOpen}
    >
      <Sidebar
        className="bg-sidebar h-auto w-full rounded-xl border md:h-full md:rounded-none md:border-0 md:border-s"
        collapsible="none"
      >
        <React.Activity mode={properties ? "hidden" : "visible"}>
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              PANEL_MOTION_CLASS,
              "slide-in-from-left-4 rtl:slide-in-from-right-4",
            )}
          >
            <SidebarHeader className="border-sidebar-border gap-3 border-b p-4">
              <div className="flex flex-col">
                <h2 className="text-sm leading-relaxed font-semibold">
                  {t("panel.title")}
                </h2>
                <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
                  {t("panel.desc")}
                </p>
              </div>

              {widgets.length > 0 && (
                <div className="relative">
                  <SearchIcon className="text-muted-foreground pointer-events-none absolute inset-s-2 top-1/2 size-4 -translate-y-1/2" />
                  <SidebarInput
                    className="ps-8"
                    onChange={event => setQuery(event.target.value)}
                    placeholder={t("panel.search")}
                    type="search"
                    value={query}
                  />
                </div>
              )}
            </SidebarHeader>

            <SidebarContent>
              {widgets.length === 0 ? (
                <Empty className="p-6">
                  <EmptyHeader>
                    <EmptyTitle className="text-sm">
                      {t("panel.empty_title")}
                    </EmptyTitle>
                    <EmptyDescription className="text-xs">
                      {t("panel.empty_desc")}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : groups.length === 0 ? (
                <Empty className="p-6">
                  <EmptyHeader>
                    <EmptyTitle className="text-sm">
                      {t("panel.no_results_title")}
                    </EmptyTitle>
                    <EmptyDescription className="text-xs">
                      {t("panel.no_results_desc", { query: query.trim() })}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                groups.map(group => (
                  <section
                    className="flex flex-col gap-2 px-4 pb-4 first:pt-4"
                    key={group.id}
                  >
                    <h3 className="text-muted-foreground text-xs leading-relaxed font-medium tracking-wider uppercase">
                      {group.title}
                    </h3>

                    <ul className="flex flex-col gap-2">
                      {group.widgets.map(widget => (
                        <PanelItem
                          key={widget.id}
                          onAdd={onAdd}
                          widget={widget}
                        />
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </SidebarContent>
          </div>
        </React.Activity>

        {properties ? (
          <div
            className={cn(
              "min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain",
              PANEL_MOTION_CLASS,
              "slide-in-from-right-4 rtl:slide-in-from-left-4",
            )}
          >
            {properties}
          </div>
        ) : null}

        {!!actions && (
          <SidebarFooter className="border-sidebar-border border-t p-4">
            {actions}
          </SidebarFooter>
        )}
      </Sidebar>
    </div>
  );
};
