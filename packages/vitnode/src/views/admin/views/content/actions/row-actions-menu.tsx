"use client";

import {
  CalendarClockIcon,
  EllipsisIcon,
  EyeIcon,
  HistoryIcon,
  LanguagesIcon,
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
import { CONTENT_PERMISSIONS } from "@/content/const";

import { DeleteContentPanel } from "./delete-action";
import { DeliveryContentPanel } from "./delivery-action";
import { HistoryContentPanel } from "./history-action";
import { PreviewContentPanel } from "./preview-action";
import { ScheduleContentPanel } from "./schedule-action";
import { TranslationsContentPanel } from "./translations-action";

/** The row actions that live behind the ⋯ button. */
type PanelId =
  "delete" | "delivery" | "history" | "preview" | "schedule" | "translations";

/** One entry in the menu, in the order the list declares it. */
interface RowAction {
  /** Whether the content type has this action *and* the role may use it. */
  available: boolean;
  /**
   * Delete, and nothing else so far: listed under a rule and in the destructive
   * colour, because the one action here that cannot be undone should not look
   * like the four above it.
   */
  destructive?: boolean;
  icon: React.ReactNode;
  id: PanelId;
  label: string;
}

/**
 * Everything a row can do that is not Publish or Edit.
 *
 * Eight icon buttons in one cell is a row nobody can read: publish and edit are
 * what people click all day and stay in the row, and everything else - preview,
 * scheduling, history, languages, delivery, delete - is listed here by name,
 * because six icons in a strip is a puzzle rather than a menu.
 *
 * Delete comes last, under a rule, because it is the one action here that cannot
 * be undone.
 *
 * Each panel is a dialog, and one is mounted at a time: a table of 25 rows costs
 * 25 buttons rather than 150 dialogs, and every panel body is behind a
 * `dynamic()` so opening one is what fetches it.
 */
export const ContentRowActionsMenu = ({
  contentTypeId,
  currentVersion,
  defaultLocale,
  delivery,
  editorial,
  id,
  locale,
  localized,
  permissionModule,
  pluginId,
  preview,
  publication,
  scheduling,
  singular,
  spec,
  title,
  version,
}: {
  contentTypeId: string;
  /** The version the row is showing, which history opens at. */
  currentVersion: number;
  defaultLocale: string;
  /** `delivery.enabled` - offers the URL panel. */
  delivery: boolean;
  /** `editorial.enabled` - offers the revision history. */
  editorial: boolean;
  id: number;
  /** The language the list is being read in, for the URL panel. */
  locale?: string;
  /** `localization.enabled` - offers the per-language panel. */
  localized: boolean;
  permissionModule: string;
  pluginId: string;
  /** `editorial.preview.enabled` - offers the signed preview link. */
  preview: boolean;
  /** `publication.enabled`, which the per-language panel needs to know. */
  publication: boolean;
  /** `editorial.scheduling.enabled` - offers the schedule panel. */
  scheduling: boolean;
  singular: string;
  spec: ContentFormSpec;
  title: string;
  /**
   * The version delete has to match, taken from the row in front of the person -
   * `undefined` for a content type without `editorial`, whose delete route has no
   * precondition.
   */
  version?: number;
}) => {
  const t = useTranslations("core.content");
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  /**
   * Which panel is mounted, and whether it is open.
   *
   * Closing keeps it mounted rather than dropping it, so the dialog can animate
   * out - unmounting a Base UI dialog mid-transition is what leaves a backdrop
   * behind over a table nobody can click any more. The dialog unmounts its own
   * body once the animation ends, so the next opening still starts from scratch.
   */
  const [panel, setPanel] = React.useState<null | {
    id: PanelId;
    open: boolean;
  }>(null);

  // The gates for the whole menu, read once per row instead of once per action:
  // reading a record covers looking at its URLs, its languages and what changed,
  // while booking a publication is publishing - just later - and deleting is its
  // own permission entirely.
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

  // Bare verbs, not the panel headings. A menu is a list of things to do, read
  // top to bottom against its icons - "Schedule", "History", "Delete" - and
  // repeating "this Article" on every line pushes the only word that differs to
  // the far right of six near-identical rows. The panel that opens still says
  // which record it is about, in its own title, where there is one of them.
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
      available: localized && canView,
      icon: <LanguagesIcon />,
      id: "translations",
      label: t("actions.translations"),
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

  // A role allowed none of these gets no button at all - an empty menu is worse
  // than a missing one.
  if (items.length === 0) return null;

  const panelProps = {
    finalFocus: triggerRef,
    onOpenChange: (open: boolean) => {
      if (open) return;

      setPanel(current => (current ? { ...current, open: false } : null));
    },
  };

  return (
    <>
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
              {/* Nothing to separate when delete is the only thing a role may
                  do. */}
              {item.destructive === true && index > 0 ? (
                <DropdownMenuSeparator />
              ) : null}

              <DropdownMenuItem
                onClick={() => {
                  setPanel({ id: item.id, open: true });
                }}
                variant={item.destructive === true ? "destructive" : "default"}
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

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

      {panel?.id === "translations" ? (
        <TranslationsContentPanel
          contentTypeId={contentTypeId}
          defaultLocale={defaultLocale}
          editorial={editorial}
          id={id}
          open={panel.open}
          permissionModule={permissionModule}
          pluginId={pluginId}
          publication={publication}
          singular={singular}
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
