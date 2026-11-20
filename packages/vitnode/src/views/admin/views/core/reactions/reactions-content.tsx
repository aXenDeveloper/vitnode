import { useQuery } from "@tanstack/react-query";
import { REACTIONS_LIMITS } from "@vitnode/api/lib/reactions/const";
import {
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SmileIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";

import type { DataTableNavigation } from "@/components/table/navigation";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { ContentDataTable } from "@/components/table/content";
import { DataTableNavigationProvider } from "@/components/table/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { reactionTitle } from "@/tanstack/reactions/query";
import { ReactionIcon } from "@/tanstack/reactions/reaction-icon";

import type { ReactionFormProps } from "./reaction-form";
import type { AdminReaction } from "./reactions-query";

import { fetchAdminReactionImpact } from "./reactions-mutations";

const ReactionForm = React.lazy(async () => await import("./reaction-form"));

export interface ReactionsContentProps {
  onDelete: (id: number) => Promise<AdminMutationResult<true>>;
  onRecount: () => Promise<AdminMutationResult<true>>;
  onReorder: (ids: number[]) => Promise<void>;
  onSave: ReactionFormProps["onSave"];
  permissions: { canManage: boolean };
  reactions: AdminReaction[];
}

export type ReactionDialogState =
  | { mode: "create" }
  | { mode: "edit"; reaction: AdminReaction };

const STATIC_NAVIGATION: DataTableNavigation = {
  navigate: () => undefined,
  searchParams: new URLSearchParams(),
};

const ReactionFormSkeleton = () => (
  <div aria-busy="true" className="flex min-h-0 flex-1 flex-col md:flex-row">
    <div className="flex shrink-0 gap-2 border-b p-2 md:w-64 md:flex-col md:border-e md:border-b-0 md:p-3">
      <Skeleton className="mx-auto mb-4 hidden size-16 rounded-2xl md:block" />
      {[0, 1, 2, 3].map(index => (
        <Skeleton className="h-11 w-28 md:w-full" key={index} />
      ))}
    </div>
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-18 w-full" />
      <Skeleton className="h-18 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  </div>
);

const DeleteReactionDialog = ({
  onClose,
  onDelete,
  reaction,
}: {
  onClose: () => void;
  onDelete: ReactionsContentProps["onDelete"];
  reaction: AdminReaction | null;
}) => {
  const t = useTranslations("admin.reactions.delete");
  const locale = useLocale();
  const name = reaction ? reactionTitle(reaction, locale) : "";
  const impactQuery = useQuery({
    enabled: reaction !== null,
    queryFn: async () => {
      if (!reaction) return null;
      const result = await fetchAdminReactionImpact(reaction.id);

      return "data" in result ? result.data : null;
    },
    queryKey: ["@vitnode/core", "admin", "reactions", "impact", reaction?.id],
  });
  const impact = impactQuery.data ?? null;

  return (
    <ConfirmActionAlertDialog
      description={impact ? `${t("desc")} ${t("impact", impact)}` : t("desc")}
      icon={<Trash2Icon />}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      onSubmit={async () => {
        if (!reaction) return;
        const result = await onDelete(reaction.id);
        if ("error" in result) {
          toast.error(t("error"), { description: t("unknown") });

          return;
        }
        toast.success(t("success"), {
          description: t("success_desc", { reaction: name }),
        });
        onClose();
      }}
      open={reaction !== null}
      textSubmit={t("confirm")}
      title={t("title", { reaction: name })}
    />
  );
};

export const CreateReactionButton = ({
  count,
  onCreate,
}: {
  count: number;
  onCreate: () => void;
}) => {
  const t = useTranslations("admin.reactions");
  const atLimit = count >= REACTIONS_LIMITS.maxReactions;

  return (
    <Button
      disabled={atLimit}
      disabledTooltip={
        atLimit ? t("limit", { max: REACTIONS_LIMITS.maxReactions }) : undefined
      }
      onClick={onCreate}
    >
      <PlusIcon aria-hidden="true" />
      {t("create")}
    </Button>
  );
};

export const RecountReputationButton = ({
  onRecount,
}: {
  onRecount: ReactionsContentProps["onRecount"];
}) => {
  const t = useTranslations("admin.reactions");

  return (
    <ConfirmActionAlertDialog
      description={t("recount_confirm.desc")}
      icon={<TriangleAlertIcon />}
      onSubmit={async ({ onClose }) => {
        const result = await onRecount();
        if ("error" in result) {
          toast.error(t("recount_error"));

          return;
        }
        toast.success(t("recount_success"), {
          description: t("recount_success_desc"),
        });
        onClose();
      }}
      textSubmit={
        <>
          <RefreshCwIcon aria-hidden="true" />
          {t("recount_confirm.submit")}
        </>
      }
      title={t("recount_confirm.title")}
    >
      <Button variant="outline">
        <RefreshCwIcon aria-hidden="true" />
        {t("recount")}
      </Button>
    </ConfirmActionAlertDialog>
  );
};

const EnabledSwitch = ({
  onSave,
  reaction,
}: {
  onSave: ReactionsContentProps["onSave"];
  reaction: AdminReaction;
}) => {
  const t = useTranslations("admin.reactions");
  const locale = useLocale();
  const name = reactionTitle(reaction, locale);
  const [isPending, setIsPending] = React.useState(false);

  return (
    <Switch
      aria-busy={isPending}
      aria-label={t("toggle", { reaction: name })}
      checked={reaction.enabled}
      disabled={isPending}
      onCheckedChange={async enabled => {
        setIsPending(true);
        try {
          const result = await onSave({
            id: reaction.id,
            values: {
              allRoles: reaction.allRoles,
              code: reaction.code,
              enabled,
              fileId: reaction.fileId,
              icon: reaction.icon,
              kind: reaction.kind,
              points: reaction.points,
              posterFileId: reaction.posterFileId,
              roles: reaction.roles,
              title: reaction.title,
            },
          });
          if ("error" in result) {
            toast.error(t("form.error"), { description: t("form.error_desc") });

            return;
          }
          toast.success(t("toggle_success"), {
            description: t("toggle_success_desc", {
              enabled: String(enabled),
              reaction: name,
            }),
          });
        } finally {
          setIsPending(false);
        }
      }}
    />
  );
};

export const ReactionsContent = ({
  onDelete,
  onOpenDialog,
  onReorder,
  onSave,
  onDialogOpenChange,
  permissions,
  reactions,
  dialog,
  dialogOpen,
}: Omit<ReactionsContentProps, "onRecount"> & {
  dialog: ReactionDialogState;
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  onOpenDialog: (state: ReactionDialogState) => void;
}) => {
  const t = useTranslations("admin.reactions");
  const locale = useLocale();
  const [deleting, setDeleting] = React.useState<AdminReaction | null>(null);

  return (
    <>
      <DataTableNavigationProvider value={STATIC_NAVIGATION}>
        <ContentDataTable<AdminReaction>
          columns={[
            {
              accessorKey: "title",
              cell: ({ row }) => (
                <span className="flex min-w-0 items-center gap-3">
                  <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg border">
                    <ReactionIcon className="size-5 text-lg" reaction={row} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">
                      {reactionTitle(row, locale)}
                    </span>
                    <code className="text-muted-foreground truncate text-xs">
                      {row.code}
                    </code>
                  </span>
                  {row.enabled ? null : (
                    <Badge variant="outline">{t("disabled")}</Badge>
                  )}
                </span>
              ),
              header: t("columns.reaction"),
            },
            {
              accessorKey: "points",
              cell: ({ row }) => (
                <span
                  className={
                    row.points < 0
                      ? "text-destructive font-medium tabular-nums"
                      : "tabular-nums"
                  }
                >
                  {row.points > 0 ? "+" : ""}
                  {t("points", { points: row.points })}
                </span>
              ),
              className: "w-24",
              header: t("columns.points"),
            },
            {
              accessorKey: "enabled",
              cell: ({ row }) =>
                permissions.canManage ? (
                  <EnabledSwitch onSave={onSave} reaction={row} />
                ) : row.enabled ? null : (
                  <Badge variant="outline">{t("disabled")}</Badge>
                ),
              className: "w-24",
              header: t("columns.enabled"),
            },
            {
              align: "right",
              cell: ({ row }) => {
                const name = reactionTitle(row, locale);

                return permissions.canManage ? (
                  <div
                    aria-label={t("actions.label", { reaction: name })}
                    className="flex justify-end gap-1"
                    role="group"
                  >
                    <TooltipWithContent text={t("actions.edit")}>
                      <Button
                        aria-label={`${t("actions.edit")}: ${name}`}
                        onClick={() => {
                          onOpenDialog({ mode: "edit", reaction: row });
                        }}
                        size="icon"
                        variant="ghost"
                      >
                        <PencilIcon aria-hidden="true" />
                      </Button>
                    </TooltipWithContent>
                    <TooltipWithContent text={t("actions.delete")}>
                      <Button
                        aria-label={`${t("actions.delete")}: ${name}`}
                        onClick={() => {
                          setDeleting(row);
                        }}
                        size="icon"
                        variant="destructive"
                      >
                        <Trash2Icon aria-hidden="true" />
                      </Button>
                    </TooltipWithContent>
                  </div>
                ) : null;
              },
              className: "w-24",
              header: "",
              id: "actions",
            },
          ]}
          customNoResults={{
            description: t("desc"),
            icon: <SmileIcon />,
            title: t("title"),
          }}
          edges={reactions}
          id="reactions-table"
          order={{ defaultOrder: { column: "position", order: "asc" } }}
          reorderable={{
            disabled: !permissions.canManage,
            getRowLabel: row => reactionTitle(row, locale),
            onReorder,
          }}
        />
      </DataTableNavigationProvider>

      <Dialog onOpenChange={onDialogOpenChange} open={dialogOpen}>
        <DialogContent className="flex h-[min(44rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b p-4 pe-14">
            <DialogTitle className="text-balance">
              {dialog.mode === "edit"
                ? t("form.edit_title")
                : t("form.create_title")}
            </DialogTitle>
            <DialogDescription className="leading-relaxed text-pretty">
              {t("form.dialog_desc")}
            </DialogDescription>
          </DialogHeader>
          <React.Suspense fallback={<ReactionFormSkeleton />}>
            <ReactionForm
              key={dialog.mode === "edit" ? dialog.reaction.id : "new"}
              onSave={onSave}
              onSaved={() => {
                onDialogOpenChange(false);
              }}
              reaction={dialog.mode === "edit" ? dialog.reaction : undefined}
            />
          </React.Suspense>
        </DialogContent>
      </Dialog>

      <DeleteReactionDialog
        onClose={() => {
          setDeleting(null);
        }}
        onDelete={onDelete}
        reaction={deleting}
      />
    </>
  );
};
