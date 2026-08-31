"use client";

import { useDraggable } from "@dnd-kit/core";
import { SearchIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";

import type { DashboardWidgetOption } from "../widgets/types";

import { groupWidgets } from "./group-widgets";
import { panelDraggableId } from "./panel-drag-id";

const PanelItem = ({ widget }: { widget: DashboardWidgetOption }) => {
  const t = useTranslations("admin.dashboard.widgets");
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: panelDraggableId(widget.id),
    data: { fromPanel: true, widget },
  });

  return (
    <li>
      <div
        aria-label={t("drag_handle", { title: widget.title })}
        className={cn(
          "flex w-full cursor-grab flex-col items-start gap-1 rounded-xl border p-4 text-start text-sm font-medium transition-all outline-none select-none active:translate-y-px active:cursor-grabbing",
          "border-border bg-background dark:border-input dark:bg-input/30 shadow-xs",
          "hover:bg-muted hover:text-foreground dark:hover:bg-input/50",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
          isDragging && "opacity-40",
        )}
        ref={setNodeRef}
        {...attributes}
        {...listeners}
      >
        <span className="flex w-full items-center gap-1.5">
          {!!widget.icon && (
            <span className="text-muted-foreground [&_svg]:size-4">
              {widget.icon}
            </span>
          )}
          <span className="truncate">{widget.title}</span>
        </span>

        {!!widget.desc && (
          <span className="text-muted-foreground text-xs leading-snug font-normal text-pretty">
            {widget.desc}
          </span>
        )}
      </div>
    </li>
  );
};

export const WidgetPanel = ({
  actions,
  isOpen,
  widgets,
}: {
  actions?: React.ReactNode;
  isOpen: boolean;
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
        "md:fixed md:inset-e-0 md:top-16 md:bottom-0 md:z-10 md:mt-0 md:flex md:w-(--dashboard-panel-width) md:transition-transform md:duration-200 md:ease-linear",
        !isOpen && "md:translate-x-full md:rtl:-translate-x-full",
      )}
      inert={!isOpen}
    >
      <Sidebar
        className="bg-sidebar h-auto w-full rounded-xl border md:h-full md:rounded-none md:border-0 md:border-s"
        collapsible="none"
      >
        <SidebarHeader className="border-sidebar-border gap-2 border-b px-3 py-3">
          <h2 className="font-medium">{t("panel.title")}</h2>
          <p className="text-muted-foreground text-xs text-pretty">
            {t("panel.desc")}
          </p>

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
              <section className="px-3 pb-3 first:pt-3" key={group.id}>
                <h3 className="text-muted-foreground px-1 pb-2 text-xs font-medium tracking-wide uppercase">
                  {group.title}
                </h3>

                <ul className="flex flex-col gap-2">
                  {group.widgets.map(widget => (
                    <PanelItem key={widget.id} widget={widget} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </SidebarContent>

        {!!actions && (
          <SidebarFooter className="border-sidebar-border border-t p-3">
            {actions}
          </SidebarFooter>
        )}
      </Sidebar>
    </div>
  );
};
