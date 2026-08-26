"use client";

import {
  CalendarClockIcon,
  EllipsisIcon,
  EyeIcon,
  HistoryIcon,
  LinkIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

import type { ContentFormSpec } from "@/content/admin/spec";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CONTENT_PERMISSIONS } from "@/content/const";

import { DeleteContentPanel } from "./delete-action";
import { DeliveryContentPanel } from "./delivery-action";
import { HistoryContentPanel } from "./history-action";
import { PreviewContentPanel } from "./preview-action";
import { ScheduleContentPanel } from "./schedule-action";

/** The row actions that live behind the ⋯ button. */
type PanelId = "delete" | "delivery" | "history" | "preview" | "schedule";

const INLINE_ACTION_LIMIT = 3;

/** One entry in the menu, in the order the list declares it. */
interface RowAction {
  available: boolean;
  destructive?: boolean;
  icon: React.ReactNode;
  id: PanelId;
  label: string;
}

export const ContentRowActionsMenu = ({
  contentTypeId,
  currentVersion,
  delivery,
  editorial,
  id,
  locale,
  permissionModule,
  pluginId,
  preview,
  scheduling,
  singular,
  spec,
  title,
  version,
}: {
  contentTypeId: string;
  currentVersion: number;
  delivery: boolean;
  editorial: boolean;
  id: number;
  locale?: string;
  permissionModule: string;
  pluginId: string;
  preview: boolean;
  scheduling: boolean;
  singular: string;
  spec: ContentFormSpec;
  title: string;
  version?: number;
}) => {
  const t = useTranslations("core.content");
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [panel, setPanel] = React.useState<null | {
    id: PanelId;
    open: boolean;
  }>(null);

  const canView = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.view,
    plugin: pluginId,
  });
  const canPublish = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.publish,
    plugin: pluginId,
  });
  const canDelete = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.delete,
    plugin: pluginId,
  });

  const actions: RowAction[] = [
    {
      available: preview && canView,
      icon: <EyeIcon />,
      id: "preview",
      label: t("actions.preview"),
    },
    {
      available: scheduling && canPublish,
      icon: <CalendarClockIcon />,
      id: "schedule",
      label: t("actions.schedule"),
    },
    {
      available: editorial && canView,
      icon: <HistoryIcon />,
      id: "history",
      label: t("actions.history"),
    },
    {
      available: delivery && canView,
      icon: <LinkIcon />,
      id: "delivery",
      label: t("actions.delivery"),
    },
    {
      available: canDelete,
      destructive: true,
      icon: <Trash2Icon />,
      id: "delete",
      label: t("actions.delete"),
    },
  ];
  const items = actions.filter(action => action.available);

  if (items.length === 0) return null;

  const panelProps = {
    finalFocus: triggerRef,
    onOpenChange: (open: boolean) => {
      if (open) return;

      setPanel(current => (current ? { ...current, open: false } : null));
    },
  };

  const openPanel = (id: PanelId) => (event: React.MouseEvent<HTMLElement>) => {
    triggerRef.current = event.currentTarget as HTMLButtonElement;
    setPanel({ id, open: true });
  };

  return (
    <>
      {items.length <= INLINE_ACTION_LIMIT ? (
        items.map(item => (
          <TooltipProvider key={item.id}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={item.label}
                    onClick={openPanel(item.id)}
                    size="icon"
                    variant={
                      item.destructive === true ? "destructive" : "ghost"
                    }
                  >
                    {item.icon}
                  </Button>
                }
              />

              <TooltipContent>{item.label}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            ref={triggerRef}
            render={
              <Button
                aria-label={t("table.more_actions")}
                size="icon"
                variant="ghost"
              />
            }
          >
            <EllipsisIcon className="size-4" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64">
            {items.map((item, index) => (
              <React.Fragment key={item.id}>
                {item.destructive === true && index > 0 ? (
                  <DropdownMenuSeparator />
                ) : null}

                <DropdownMenuItem
                  onClick={() => {
                    setPanel({ id: item.id, open: true });
                  }}
                  variant={
                    item.destructive === true ? "destructive" : "default"
                  }
                >
                  {item.icon}
                  {item.label}
                </DropdownMenuItem>
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {panel?.id === "preview" ? (
        <PreviewContentPanel
          contentTypeId={contentTypeId}
          id={id}
          open={panel.open}
          title={title}
          {...panelProps}
        />
      ) : null}

      {panel?.id === "schedule" ? (
        <ScheduleContentPanel
          contentTypeId={contentTypeId}
          id={id}
          open={panel.open}
          singular={singular}
          title={title}
          {...panelProps}
        />
      ) : null}

      {panel?.id === "history" ? (
        <HistoryContentPanel
          contentTypeId={contentTypeId}
          currentVersion={currentVersion}
          id={id}
          open={panel.open}
          permissionModule={permissionModule}
          pluginId={pluginId}
          singular={singular}
          spec={spec}
          title={title}
          {...panelProps}
        />
      ) : null}

      {panel?.id === "delivery" ? (
        <DeliveryContentPanel
          contentTypeId={contentTypeId}
          id={id}
          locale={locale}
          open={panel.open}
          singular={singular}
          {...panelProps}
        />
      ) : null}

      {panel?.id === "delete" ? (
        <DeleteContentPanel
          contentTypeId={contentTypeId}
          id={id}
          open={panel.open}
          singular={singular}
          title={title}
          version={version}
          {...panelProps}
        />
      ) : null}
    </>
  );
};
