import { PencilIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";

import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { formatAiPoints } from "@/lib/ai/format-points";

import type { AdminAiUserOverride } from "../ai-query";
import type { AiUserOverrideFormProps } from "./user-override-form";

const AiUserOverrideForm = React.lazy(async () =>
  import("./user-override-form").then(module => ({
    default: module.AiUserOverrideForm,
  })),
);

export interface AiUserOverrideCardProps {
  canManage: boolean;
  onDelete: (userId: number) => Promise<AdminMutationResult<true>>;
  onSave: AiUserOverrideFormProps["onSave"];
  override: AdminAiUserOverride | null;
  userId: number;
}

const OverrideSummary = ({
  override,
}: {
  override: AdminAiUserOverride | null;
}) => {
  const t = useTranslations("admin.user.ai");
  const locale = useLocale();

  if (!override) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("follows_roles")}
      </p>
    );
  }
  if (override.blocked)
    return <Badge variant="destructive">{t("blocked")}</Badge>;
  if (override.unlimited)
    return <Badge variant="success">{t("unlimited")}</Badge>;
  if (override.monthlyPoints === null) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("follows_roles")}
      </p>
    );
  }

  return (
    <Badge variant="outline">
      {t("points_month", {
        points: formatAiPoints(override.monthlyPoints, locale),
      })}
    </Badge>
  );
};

export const AiUserOverrideCardContent = ({
  canManage,
  onDelete,
  onSave,
  override,
  userId,
}: AiUserOverrideCardProps) => {
  const t = useTranslations("admin.user.ai");
  const tError = useTranslations("core.global.errors");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [removeOpen, setRemoveOpen] = React.useState(false);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="text-muted-foreground size-5" />
          {t("title")}
        </CardTitle>
        <CardDescription className="leading-relaxed text-pretty">
          {t("desc")}
        </CardDescription>
        {canManage ? (
          <CardAction className="flex items-center gap-1">
            <Dialog>
              <TooltipWithContent text={t("edit")}>
                <DialogTrigger
                  render={
                    <Button
                      aria-label={t("edit")}
                      size="icon"
                      variant="ghost"
                    />
                  }
                >
                  <PencilIcon />
                </DialogTrigger>
              </TooltipWithContent>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("edit")}</DialogTitle>
                  <DialogDescription>{t("form_desc")}</DialogDescription>
                </DialogHeader>
                <React.Suspense
                  fallback={
                    <div className="flex items-center justify-center">
                      <Spinner size="xl" />
                    </div>
                  }
                >
                  <AiUserOverrideForm
                    data={override}
                    onSave={onSave}
                    userId={userId}
                  />
                </React.Suspense>
              </DialogContent>
            </Dialog>
            {override ? (
              <AlertDialog onOpenChange={setRemoveOpen} open={removeOpen}>
                <TooltipWithContent text={t("remove.title")}>
                  <AlertDialogTrigger
                    render={
                      <Button
                        aria-label={t("remove.title")}
                        size="icon"
                        variant="ghost"
                      />
                    }
                  >
                    <Trash2Icon />
                  </AlertDialogTrigger>
                </TooltipWithContent>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("remove.title")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("remove.desc")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("remove.cancel")}</AlertDialogCancel>
                    <Button
                      disabled={isDeleting}
                      onClick={async () => {
                        setIsDeleting(true);
                        let result: Awaited<ReturnType<typeof onDelete>>;
                        try {
                          result = await onDelete(userId);
                        } finally {
                          setIsDeleting(false);
                        }
                        if ("error" in result) {
                          toast.error(tError("title"), {
                            description: tError("internal_server_error"),
                          });

                          return;
                        }
                        toast.success(t("remove.success"), {
                          description: t("remove.success_desc"),
                        });
                        setRemoveOpen(false);
                      }}
                      variant="destructive"
                    >
                      {isDeleting ? <Spinner /> : null}
                      {t("remove.confirm")}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <OverrideSummary override={override} />
      </CardContent>
    </Card>
  );
};
