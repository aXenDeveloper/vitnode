import type { QueueCleanScope } from "@vitnode/api/modules/queue/lib/process-queue-tasks";

import { Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { ContentConfirmAction } from "@/components/confirm-action/content";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { isAdminMutationError } from "@/views/admin/views/core/shared/admin-mutation";

const SCOPES: readonly QueueCleanScope[] = ["failed", "finished"];

const isScope = (value: unknown): value is QueueCleanScope =>
  SCOPES.some(scope => scope === value);

export const CleanQueueAction = ({
  counts,
  onClean,
}: {
  counts?: { completed: number; failed: number };
  onClean: (
    scope: QueueCleanScope,
  ) => Promise<AdminMutationResult<{ deleted: number }>>;
}) => {
  const t = useTranslations("admin.debug.actions.clean_queue");
  const tErrors = useTranslations("core.global.errors");
  const [scope, setScope] = React.useState<QueueCleanScope>("failed");
  const countOf = (option: QueueCleanScope) =>
    counts
      ? option === "failed"
        ? counts.failed
        : counts.failed + counts.completed
      : null;

  return (
    <AlertDialog
      onOpenChange={open => {
        if (open) setScope("failed");
      }}
    >
      <AlertDialogTrigger
        render={
          <Button variant="outline">
            <Trash2Icon aria-hidden />
            {t("label")}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20">
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("desc")}</AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup
          aria-label={t("scope_label")}
          onValueChange={next => {
            if (isScope(next)) setScope(next);
          }}
          value={scope}
        >
          {SCOPES.map(option => {
            const count = countOf(option);

            return (
              <Label
                className="flex items-start gap-3 rounded-lg border p-3"
                key={option}
              >
                <RadioGroupItem className="mt-0.5" value={option} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm font-medium">
                    {t(`scope.${option}.title`)}
                  </span>
                  <span className="text-muted-foreground text-xs leading-relaxed font-normal text-pretty">
                    {t(`scope.${option}.desc`)}
                  </span>
                </span>
                {count === null ? null : (
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {t("count", { count })}
                  </span>
                )}
              </Label>
            );
          })}
        </RadioGroup>

        <ContentConfirmAction
          onSubmit={async ({ onClose }) => {
            const result = await onClean(scope);
            if (isAdminMutationError(result)) {
              toast.error(tErrors("title"), {
                description:
                  result.error.status === 403
                    ? tErrors("403.desc")
                    : tErrors("internal_server_error"),
              });

              return;
            }

            onClose();
            toast.success(t("success.title"), {
              description: t(`success.${scope}`, {
                count: result.data.deleted,
              }),
            });
          }}
          textSubmit={
            <>
              <Trash2Icon aria-hidden />
              {t("confirm")}
            </>
          }
        />
      </AlertDialogContent>
    </AlertDialog>
  );
};
