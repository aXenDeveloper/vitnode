import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  CircleDotIcon,
  EyeIcon,
  FileClockIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { ContentId } from "@/content/ids";
import type { RegisteredFrontendContentType } from "@/content/index";
import type { ContentLabels } from "@/views/admin/views/content/content-labels";
import type {
  ContentBulkAction,
  ContentBulkGroupId,
  ContentBulkResult,
} from "@/views/admin/views/content/table/bulk-actions-model";
import type { ContentRowData } from "@/views/admin/views/content/table/cells";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { useDataTableSelection } from "@/components/table/selection";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { CONTENT_VISIBILITY_ICONS } from "@/views/admin/views/content/actions/visibility-dialog";
import {
  CONTENT_BULK_GROUPS,
  contentBulkActionApplies,
  runContentBulkAction,
} from "@/views/admin/views/content/table/bulk-actions-model";
import { contentRowTitle } from "@/views/admin/views/content/table/columns";
import {
  deleteContentInBrowser,
  setContentPublicationInBrowser,
  setContentVisibilityInBrowser,
} from "@/views/admin/views/content/table/list-mutations";

import { contentApiTarget, invalidateContentAfterBulkWrite } from "./query";

const TITLES_IN_TOAST = 3;

const ACTION_ICONS: Record<ContentBulkAction, React.ReactNode> = {
  ...CONTENT_VISIBILITY_ICONS,
  delete: <Trash2Icon />,
  publish: <SendIcon />,
  unpublish: <FileClockIcon />,
};

const GROUP_ICONS: Record<ContentBulkGroupId, React.ReactNode> = {
  status: <CircleDotIcon />,
  visibility: <EyeIcon />,
};

const CONFIRMS_WITHOUT_LOSS = new Set<ContentBulkAction>(["publish", "unhide"]);

export interface ContentBulkActionsProps {
  actions: readonly ContentBulkAction[];
  entry: RegisteredFrontendContentType;
  labels: Pick<ContentLabels, "plural" | "singular">;
  rows: readonly ContentRowData[];
}

export const ContentBulkActions = ({
  actions,
  entry,
  labels,
  rows,
}: ContentBulkActionsProps) => {
  const { definition, pluginId } = entry;
  const t = useTranslations("core.content.bulk");
  const tContent = useTranslations("core.content");
  const tActions = useTranslations("core.content.actions");
  const tErrors = useTranslations("core.global.errors");
  const queryClient = useQueryClient();
  const { clear, selected, toggle } = useDataTableSelection();
  const [pending, setPending] = React.useState<ContentBulkAction | null>(null);
  const [open, setOpen] = React.useState(false);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const settledRef = React.useRef<null | {
    action: ContentBulkAction;
    result: ContentBulkResult;
    targets: ContentId[];
  }>(null);

  const rowsById = new Map(rows.map(row => [row.id, row]));
  const nameFor = (count: number) =>
    count === 1 ? labels.singular : labels.plural;
  const target = contentApiTarget(definition, pluginId);
  const groups = CONTENT_BULK_GROUPS.map(group => ({
    ...group,
    actions: group.actions.filter(action => actions.includes(action)),
  })).filter(group => group.actions.length > 0);

  const targetsOf = (action: ContentBulkAction): ContentId[] =>
    selected.filter(id => {
      const row = rowsById.get(id);

      return row !== undefined && contentBulkActionApplies(action, row);
    });

  const runOne = async (action: ContentBulkAction, id: ContentId) => {
    switch (action) {
      case "delete": {
        const version = rowsById.get(id)?.version;

        return await deleteContentInBrowser({
          editorial: definition.editorial.enabled,
          id,
          target,
          version: typeof version === "number" ? version : 1,
        });
      }
      case "hide":
      case "unhide":
        return await setContentVisibilityInBrowser({ action, id, target });
      case "publish":
      case "unpublish":
        return await setContentPublicationInBrowser({ action, id, target });
    }
  };

  const titlesOf = (ids: readonly ContentId[]): string => {
    const titles = ids
      .slice(0, TITLES_IN_TOAST)
      .map(id => rowsById.get(id))
      .filter(row => row !== undefined)
      .map(row => contentRowTitle(definition, row));
    const rest = ids.length - titles.length;

    return rest > 0
      ? `${titles.join(", ")} ${t("more", { count: rest })}`
      : titles.join(", ");
  };

  const report = (
    action: ContentBulkAction,
    { conflicted, failed, succeeded }: ContentBulkResult,
  ) => {
    if (succeeded.length > 0) {
      toast.success(
        t(`${action}.success`, {
          count: succeeded.length,
          name: nameFor(succeeded.length),
        }),
        { description: titlesOf(succeeded) },
      );
    }

    if (conflicted > 0) {
      toast.error(tErrors("title"), {
        description: t("conflict", { count: conflicted }),
      });
    }

    if (failed > 0) {
      toast.error(tErrors("title"), {
        description: t("failed", { count: failed }),
      });
    }
  };

  const applySettled = async () => {
    const settled = settledRef.current;
    settledRef.current = null;
    if (!settled || settled.result.succeeded.length === 0) return;

    const succeeded = new Set(settled.result.succeeded);
    const stillSelected = new Set(
      settled.targets.filter(id => !succeeded.has(id)),
    );

    if (stillSelected.size === 0) clear();
    else for (const id of selected) if (!stillSelected.has(id)) toggle(id);

    await invalidateContentAfterBulkWrite(queryClient, {
      contentTypeId: definition.id,
      itemIds: settled.result.succeeded,
      removed: settled.action === "delete",
    });
  };

  const choose = (action: ContentBulkAction) => {
    setPending(action);
    setOpen(true);
  };

  const rememberTrigger = (event: React.MouseEvent<HTMLElement>) => {
    returnFocusRef.current = event.currentTarget;
  };

  const pendingCount = pending ? targetsOf(pending).length : 0;

  return (
    <>
      {groups.map(group => (
        <DropdownMenu key={group.id}>
          <DropdownMenuTrigger
            onClick={rememberTrigger}
            render={<Button size="sm" variant="ghost" />}
          >
            {GROUP_ICONS[group.id]}
            <span className="max-sm:sr-only">
              {tContent(`${group.id}.label`)}
            </span>
            <ChevronDownIcon className="text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-56" side="top">
            {group.actions.map(action => {
              const applies = targetsOf(action).length;

              return (
                <DropdownMenuItem
                  disabled={applies === 0}
                  key={action}
                  onClick={() => {
                    choose(action);
                  }}
                >
                  {ACTION_ICONS[action]}
                  <span className="flex-1">{tActions(action)}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {t("applies", { count: applies, total: selected.length })}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}

      {actions.includes("delete") ? (
        <>
          {groups.length > 0 ? (
            <Separator
              className="mx-0.5 data-[orientation=vertical]:h-6"
              orientation="vertical"
            />
          ) : null}
          <Button
            onClick={event => {
              rememberTrigger(event);
              choose("delete");
            }}
            size="sm"
            variant="destructive"
          >
            {ACTION_ICONS.delete}
            <span className="max-sm:sr-only">{tActions("delete")}</span>
          </Button>
        </>
      ) : null}

      {pending ? (
        <ConfirmActionAlertDialog
          description={t(`${pending}.desc`, { count: pendingCount })}
          finalFocus={returnFocusRef}
          icon={ACTION_ICONS[pending]}
          onOpenChange={setOpen}
          onOpenChangeComplete={next => {
            if (!next) void applySettled();
          }}
          onSubmit={async ({ onClose }) => {
            const targets = targetsOf(pending);
            const result = await runContentBulkAction(targets, async id =>
              runOne(pending, id),
            );

            report(pending, result);
            settledRef.current = { action: pending, result, targets };
            onClose();
          }}
          open={open}
          submitVariant={
            CONFIRMS_WITHOUT_LOSS.has(pending) ? "default" : "destructive"
          }
          textSubmit={t(`${pending}.confirm`)}
          title={t(`${pending}.title`, {
            count: pendingCount,
            name: nameFor(pendingCount),
          })}
        />
      ) : null}
    </>
  );
};
