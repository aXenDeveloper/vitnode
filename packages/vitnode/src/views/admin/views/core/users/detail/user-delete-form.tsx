import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormCheckbox } from "@/components/form/fields/checkbox";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { useDialog } from "@/components/ui/dialog";

import type { UserDeleteCardProps } from "./user-delete-card";

import { isAdminMutationError } from "../../shared/admin-mutation";

/** The AdminCP "Delete account" dialog's form. Lazy-loaded. */
export const UserDeleteForm = ({
  onDelete,
  onErased,
  onFailure,
  user,
}: Pick<UserDeleteCardProps, "onDelete" | "onErased" | "user"> & {
  onFailure: (status: number) => void;
}) => {
  const t = useTranslations("admin.user.show.delete");
  const { setOpen } = useDialog();
  const formSchema = z.object({
    immediately: z.boolean().default(false),
    understand: z
      .boolean()
      .default(false)
      .refine(value => value, t("understand_required")),
  });

  return (
    <AutoForm
      fields={[
        {
          id: "immediately",
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("immediately_desc")}
              label={t("immediately")}
            />
          ),
        },
        {
          id: "understand",
          component: props => (
            <AutoFormCheckbox
              {...props}
              label={t("understand", { name: user.name })}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={async ({ immediately }) => {
        const result = await onDelete({ immediately });
        if (isAdminMutationError(result)) {
          onFailure(result.error.status);

          return;
        }
        setOpen?.(false);

        if (result.data.status === "scheduled") {
          toast.success(t("schedule.success"), {
            description: t("schedule.success_desc", { name: user.name }),
          });

          return;
        }

        toast.success(t("now.success"), {
          description:
            result.data.filesKept > 0
              ? t("now.success_desc_kept", {
                  count: result.data.filesKept,
                  name: user.name,
                })
              : t("now.success_desc", { name: user.name }),
        });
        await onErased();
      }}
      submitButtonProps={{
        children: (
          <>
            <Trash2Icon aria-hidden="true" />
            {t("submit")}
          </>
        ),
        variant: "destructive",
      }}
    />
  );
};
