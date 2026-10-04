import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import type { NotificationsAdminActions } from "./notifications-mutations";

export const DeleteAllDialog = ({
  count,
  onDelete,
  trigger,
}: {
  count: number;
  onDelete: NotificationsAdminActions["deleteAll"];
  trigger: React.ReactElement;
}) => {
  const t = useTranslations("admin.system.notifications.danger.delete_all");
  const tError = useTranslations("core.global.errors");
  const tConfirm = useTranslations("core.global.confirm_action");
  const [open, setOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const phrase = t("phrase");
  const formSchema = z.object({
    confirmation: z
      .string({ error: () => t("phrase_error") })
      .refine(
        value => value.trim().toLowerCase() === phrase.toLowerCase(),
        t("phrase_error"),
      ),
  });

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`${t("title")}?`}</AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed text-pretty">
            {t("confirm_desc", { count })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AutoForm
          fields={[
            {
              id: "confirmation",
              component: props => (
                <AutoFormInput
                  {...props}
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  className="text-base sm:text-sm"
                  label={t.rich("phrase_label", {
                    phrase: () => (
                      <strong className="font-mono font-medium select-all">
                        {phrase}
                      </strong>
                    ),
                  })}
                  spellCheck={false}
                />
              ),
            },
          ]}
          formSchema={formSchema}
          layout={rendered => (
            <div className="flex flex-col gap-4">
              {rendered.confirmation}
              <AlertDialogFooter>
                <Button
                  onClick={() => {
                    setOpen(false);
                  }}
                  type="button"
                  variant="outline"
                >
                  {tConfirm("cancel")}
                </Button>
                <Button
                  isLoading={isDeleting}
                  type="submit"
                  variant="destructive"
                >
                  {t("submit")}
                </Button>
              </AlertDialogFooter>
            </div>
          )}
          onSubmit={async () => {
            setIsDeleting(true);
            const mutation = await onDelete();
            setIsDeleting(false);

            if (mutation.error !== undefined) {
              toast.error(tError("title"), {
                description: tError("internal_server_error"),
              });

              return;
            }

            setOpen(false);
            toast.success(t("success"), {
              description: t("success_desc", { count: mutation.data.items }),
            });
          }}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
};
