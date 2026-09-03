"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarClockIcon,
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  HistoryIcon,
  LinkIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { RegisteredFrontendContentType } from "@/content/index";
import type { ContentRowActionId } from "@/views/admin/views/content/actions/row-actions-model";
import type { ContentRowData } from "@/views/admin/views/content/table/cells";
import type { ContentRowMutationResult } from "@/views/admin/views/content/table/list-mutations";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
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
import {
  CONTENT_PERMISSIONS,
  contentEditHref,
  contentPublicationTransition,
} from "@/content/index";
import {
  contentRowActionIds,
  contentRowActionsAreInline,
  isDestructiveContentRowAction,
} from "@/views/admin/views/content/actions/row-actions-model";
import { contentErrorKey } from "@/views/admin/views/content/lib/mutation-feedback";
import { contentRowTitle } from "@/views/admin/views/content/table/columns";

import { RouterLink } from "../../layout/router-link";
import { useAdminPermission } from "../permissions";
import {
  contentApiTarget,
  deleteContentRow,
  setContentPublication,
} from "./query";
import { ContentFormDialogSlot, ContentRowPanelSlot } from "./slot-render";
import { contentAdminSlots, registeredContentRowPanels } from "./slots";

export interface ContentRowActionsProps {
  entry: RegisteredFrontendContentType;
  /** How a path becomes a navigation. See {@link RouterLink} for the default. */
  LinkComponent?: AuthLinkComponent;
  /** The language the list is being read in. */
  locale: string;
  row: ContentRowData;
  /** The content type's noun, as this administrator reads it. */
  singular: string;
}

/** The version a row is at, or `1` for a content type without revisions. */
const versionOf = (row: ContentRowData): number =>
  typeof row.version === "number" ? row.version : 1;

const useMutationToast = () => {
  const tErrors = useTranslations("core.global.errors");
  const tContentErrors = useTranslations("core.content.errors");

  return React.useCallback(
    (result: ContentRowMutationResult) => {
      const errorKey = contentErrorKey(result.status, {
        ...(result.conflict ? { conflict: result.conflict } : {}),
      });

      toast.error(tErrors("title"), {
        description: errorKey
          ? tContentErrors(errorKey)
          : tErrors("internal_server_error"),
      });
    },
    [tContentErrors, tErrors],
  );
};

const PublishRowAction = ({
  entry,
  row,
  singular,
  title,
}: {
  entry: RegisteredFrontendContentType;
  row: ContentRowData;
  singular: string;
  title: string;
}) => {
  const { definition, pluginId } = entry;
  const tPublish = useTranslations("core.content.publish");
  const tUnpublish = useTranslations("core.content.unpublish");
  const tActions = useTranslations("core.content.actions");
  const queryClient = useQueryClient();
  const showError = useMutationToast();
  const canPublish = useAdminPermission({
    module: definition.permissionModule,
    permission: CONTENT_PERMISSIONS.publish,
    plugin: pluginId,
  });

  if (!definition.publication.enabled || !canPublish) return null;

  const { action, destructive: published } = contentPublicationTransition(
    row.status,
  );
  const t = published ? tUnpublish : tPublish;
  const label = tActions(action);
  const Icon = published ? EyeOffIcon : SendIcon;

  return (
    <TooltipProvider>
      <Tooltip>
        <ConfirmActionAlertDialog
          description={t.rich("desc", {
            title: () => (
              <span className="text-foreground font-bold">{title}</span>
            ),
          })}
          onSubmit={async ({ onClose }) => {
            const result = await setContentPublication(queryClient, {
              action,
              contentTypeId: definition.id,
              id: row.id,
              target: contentApiTarget(definition, pluginId),
            });

            if (result.error !== undefined) {
              showError(result);

              return;
            }

            toast.success(t("success", { name: singular }), {
              description: title,
            });
            onClose();
          }}
          submitVariant={published ? "destructive" : "default"}
          textSubmit={t("confirm")}
          title={t("title", { name: singular })}
        >
          <TooltipTrigger
            render={
              <Button aria-label={label} size="icon" variant="ghost">
                <Icon className="size-4" />
              </Button>
            }
          />
        </ConfirmActionAlertDialog>

        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const EditRowAction = ({
  entry,
  LinkComponent = RouterLink,
  row,
  singular,
  title,
}: {
  entry: RegisteredFrontendContentType;
  LinkComponent?: AuthLinkComponent;
  row: ContentRowData;
  singular: string;
  title: string;
}) => {
  const { definition, pluginId } = entry;
  const label = useTranslations("core.content.actions")("edit");
  const canEdit = useAdminPermission({
    module: definition.permissionModule,
    permission: CONTENT_PERMISSIONS.edit,
    plugin: pluginId,
  });
  const formDialog = contentAdminSlots().FormDialog;

  if (!canEdit) return null;

  const button = (
    <Button aria-label={label} size="icon" variant="ghost">
      <PencilIcon className="size-4" />
    </Button>
  );

  if (definition.admin.edit.mode === "page") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={label}
                nativeButton={false}
                render={
                  <LinkComponent href={contentEditHref(definition, row.id)} />
                }
                size="icon"
                variant="ghost"
              >
                <PencilIcon className="size-4" />
              </Button>
            }
          />

          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Dialog mode with nothing registered to open: no control at all, rather than
  // a pencil that does nothing. The record is still reachable - `admin.edit.mode`
  // only decides where the form appears, and the API is unchanged either way.
  if (!formDialog) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <ContentFormDialogSlot
          action="edit"
          dialog={formDialog}
          entry={entry}
          row={row}
          singular={singular}
          title={title}
        >
          <TooltipTrigger render={button} />
        </ContentFormDialogSlot>

        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/** The icon each row action wears. Order and gating are the shared model's. */
const ACTION_ICONS: Record<ContentRowActionId, React.ReactNode> = {
  delete: <Trash2Icon />,
  delivery: <LinkIcon />,
  history: <HistoryIcon />,
  preview: <EyeIcon />,
  schedule: <CalendarClockIcon />,
};

const ContentRowActionsMenu = ({
  entry,
  locale,
  row,
  singular,
  title,
}: {
  entry: RegisteredFrontendContentType;
  locale: string;
  row: ContentRowData;
  singular: string;
  title: string;
}) => {
  const { definition, pluginId } = entry;
  const t = useTranslations("core.content");
  const tDelete = useTranslations("core.content.delete");
  const queryClient = useQueryClient();
  const showError = useMutationToast();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [panel, setPanel] = React.useState<null | {
    id: ContentRowActionId;
    open: boolean;
  }>(null);

  const module = definition.permissionModule;
  const canView = useAdminPermission({
    module,
    permission: CONTENT_PERMISSIONS.view,
    plugin: pluginId,
  });
  const canPublish = useAdminPermission({
    module,
    permission: CONTENT_PERMISSIONS.publish,
    plugin: pluginId,
  });
  const canDelete = useAdminPermission({
    module,
    permission: CONTENT_PERMISSIONS.delete,
    plugin: pluginId,
  });

  const slots = contentAdminSlots();
  const items = contentRowActionIds({
    canDelete,
    canPublish,
    canView,
    delivery: definition.delivery.enabled,
    editorial: definition.editorial.enabled,
    preview: definition.editorial.preview.enabled,
    renderable: ["delete", ...registeredContentRowPanels(slots)],
    scheduling: definition.editorial.scheduling.enabled,
  }).map(id => ({
    destructive: isDestructiveContentRowAction(id),
    icon: ACTION_ICONS[id],
    id,
    label: t(`actions.${id}`),
  }));

  if (items.length === 0) return null;

  const closePanel = (open: boolean) => {
    if (open) return;

    setPanel(current => (current ? { ...current, open: false } : null));
  };

  const openInline =
    (id: ContentRowActionId) => (event: React.MouseEvent<HTMLElement>) => {
      triggerRef.current = event.currentTarget as HTMLButtonElement;
      setPanel({ id, open: true });
    };

  const rowPanel =
    panel && panel.id !== "delete" ? slots.rowPanels?.[panel.id] : undefined;

  return (
    <>
      {contentRowActionsAreInline(items.length) ? (
        items.map(item => (
          <TooltipProvider key={item.id}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={item.label}
                    onClick={openInline(item.id)}
                    size="icon"
                    variant={item.destructive ? "destructive" : "ghost"}
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
                {item.destructive && index > 0 ? (
                  <DropdownMenuSeparator />
                ) : null}

                <DropdownMenuItem
                  onClick={() => {
                    setPanel({ id: item.id, open: true });
                  }}
                  variant={item.destructive ? "destructive" : "default"}
                >
                  {item.icon}
                  {item.label}
                </DropdownMenuItem>
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {panel?.id === "delete" ? (
        <ConfirmActionAlertDialog
          description={tDelete.rich("desc", {
            title: () => (
              <span className="text-foreground font-bold">{title}</span>
            ),
          })}
          finalFocus={triggerRef}
          onOpenChange={closePanel}
          onSubmit={async ({ onClose }) => {
            const result = await deleteContentRow(queryClient, {
              contentTypeId: definition.id,
              editorial: definition.editorial.enabled,
              id: row.id,
              target: contentApiTarget(definition, pluginId),
              version: definition.editorial.enabled
                ? versionOf(row)
                : undefined,
            });

            if (result.error !== undefined) {
              if (result.conflict?.code === "CONTENT_VERSION_CONFLICT") {
                toast.error(tDelete("conflict.title"), {
                  description: tDelete("conflict.desc"),
                });

                return;
              }

              showError(result);

              return;
            }

            toast.success(tDelete("success", { name: singular }), {
              description: title,
            });
            onClose();
          }}
          open={panel.open}
          textSubmit={tDelete("confirm")}
          title={tDelete("title", { name: singular })}
        />
      ) : null}

      {rowPanel && panel ? (
        <ContentRowPanelSlot
          currentVersion={versionOf(row)}
          entry={entry}
          finalFocus={triggerRef}
          itemId={row.id}
          {...(definition.localization.enabled ? { locale } : {})}
          onOpenChange={closePanel}
          open={panel.open}
          panel={rowPanel}
          singular={singular}
          title={title}
          {...(definition.editorial.enabled ? { version: versionOf(row) } : {})}
        />
      ) : null}
    </>
  );
};

export const ContentRowActions = ({
  entry,
  LinkComponent,
  locale,
  row,
  singular,
}: ContentRowActionsProps) => {
  const title = contentRowTitle(entry.definition, row);

  return (
    <>
      <PublishRowAction
        entry={entry}
        row={row}
        singular={singular}
        title={title}
      />
      <EditRowAction
        entry={entry}
        LinkComponent={LinkComponent}
        row={row}
        singular={singular}
        title={title}
      />
      <ContentRowActionsMenu
        entry={entry}
        locale={locale}
        row={row}
        singular={singular}
        title={title}
      />
    </>
  );
};
