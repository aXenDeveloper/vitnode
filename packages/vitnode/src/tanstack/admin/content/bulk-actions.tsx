import { useQueryClient } from "@tanstack/react-query";
import { EyeOffIcon, SendIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { ContentId } from "@/content/ids";
import type { RegisteredFrontendContentType } from "@/content/index";
import type { ContentLabels } from "@/views/admin/views/content/content-labels";
import type {
  ContentBulkAction,
  ContentBulkResult,
} from "@/views/admin/views/content/table/bulk-actions-model";
import type { ContentRowData } from "@/views/admin/views/content/table/cells";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { useDataTableSelection } from "@/components/table/selection";
import { Button } from "@/components/ui/button";
import { runContentBulkAction } from "@/views/admin/views/content/table/bulk-actions-model";
import { contentRowTitle } from "@/views/admin/views/content/table/columns";
import {
  deleteContentInBrowser,
  setContentPublicationInBrowser,
} from "@/views/admin/views/content/table/list-mutations";

import { contentApiTarget, invalidateContentAfterBulkWrite } from "./query";

const TITLES_IN_TOAST = 3;

const ACTION_ICONS: Record<ContentBulkAction, React.ReactNode> = {
  delete: <Trash2Icon />,
  publish: <SendIcon />,
  unpublish: <EyeOffIcon />,
};

export interface ContentBulkActionsProps {
  actions: readonly ContentBulkAction[];
  entry: RegisteredFrontendContentType;
  labels: Pick<ContentLabels, "plural" | "singular">;
  rows: readonly ContentRowData[];
}

const ContentBulkActionButton = ({
  action,
  entry,
  labels,
  rows,
}: Omit<ContentBulkActionsProps, "actions"> & {
  action: ContentBulkAction;
}) => {
  const { definition, pluginId } = entry;
  const t = useTranslations("core.content.bulk");
  const tActions = useTranslations("core.content.actions");
  const tErrors = useTranslations("core.global.errors");
  const queryClient = useQueryClient();
  const { clear, selected, toggle } = useDataTableSelection();
  const settledRef = React.useRef<ContentId[] | null>(null);

  const rowsById = new Map(rows.map(row => [row.id, row]));
  const nameFor = (count: number) =>
    count === 1 ? labels.singular : labels.plural;
  const target = contentApiTarget(definition, pluginId);

  const runOne = async (id: ContentId) => {
    if (action !== "delete") {
      return await setContentPublicationInBrowser({ action, id, target });
    }

    const version = rowsById.get(id)?.version;

    return await deleteContentInBrowser({
      editorial: definition.editorial.enabled,
      id,
      target,
      version: typeof version === "number" ? version : 1,
    });
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

  const report = ({ conflicted, failed, succeeded }: ContentBulkResult) => {
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
    const succeeded = settledRef.current;
    settledRef.current = null;
    if (!succeeded || succeeded.length === 0) return;

    if (succeeded.length === selected.length) clear();
    else for (const id of succeeded) toggle(id);

    await invalidateContentAfterBulkWrite(queryClient, {
      contentTypeId: definition.id,
      itemIds: succeeded,
      removed: action === "delete",
    });
  };

  const count = selected.length;

  return (
    <ConfirmActionAlertDialog
      description={t(`${action}.desc`, { count })}
      icon={ACTION_ICONS[action]}
      onOpenChangeComplete={open => {
        if (!open) void applySettled();
      }}
      onSubmit={async ({ onClose }) => {
        const result = await runContentBulkAction([...selected], runOne);

        report(result);
        settledRef.current = result.succeeded;
        onClose();
      }}
      submitVariant={action === "publish" ? "default" : "destructive"}
      textSubmit={t(`${action}.confirm`)}
      title={t(`${action}.title`, { count, name: nameFor(count) })}
    >
      <Button size="sm" variant={action === "delete" ? "destructive" : "ghost"}>
        {ACTION_ICONS[action]}
        {tActions(action)}
      </Button>
    </ConfirmActionAlertDialog>
  );
};

export const ContentBulkActions = ({
  actions,
  ...props
}: ContentBulkActionsProps) =>
  actions.map(action => (
    <ContentBulkActionButton action={action} key={action} {...props} />
  ));
