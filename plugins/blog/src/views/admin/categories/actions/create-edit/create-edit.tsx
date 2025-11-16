import {
  AutoForm,
  type AutoFormOnSubmit,
} from "@vitnode/core/components/form/auto-form";
import { AutoFormInput } from "@vitnode/core/components/form/fields/input";
import { useDialog } from "@vitnode/core/components/ui/dialog";
import { usePathname, useRouter } from "@vitnode/core/lib/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";

import type { zodCreateCategorySchema } from "@/api/modules/admin/categories/routes/create.route";

import { createMutationApi, editMutationApi } from "./mutation-api";

export const CreateEditActionCategoriesAdmin = ({
  data,
}: {
  data?: z.infer<typeof zodCreateCategorySchema> & { id: number };
}) => {
  const t = useTranslations("@vitnode/blog.admin.categories");
  const tCore = useTranslations("core.global.errors");
  const { setOpen } = useDialog();
  const { push } = useRouter();
  const pathname = usePathname();
  const formSchema = z.object({
    title: z.string().default(data?.title ?? ""),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    form,
  ) => {
    let error = "";
    const payload = values as z.infer<typeof zodCreateCategorySchema>;

    if (data?.id) {
      const mutation = await editMutationApi({
        id: data.id,
        ...payload,
      });

      if (mutation?.error) {
        error = mutation.error;
      }
    } else {
      const mutation = await createMutationApi(payload);

      if (mutation?.error) {
        error = mutation.error;
      }
    }

    if (error) {
      if (error.includes("already exists")) {
        form.setError("title", {
          type: "manual",
          message: t("create.form.title.already_exists"),
        });

        return;
      }

      toast.error(tCore("title"), {
        description: tCore("internal_server_error"),
      });

      return;
    }
    setOpen?.(false);
    push(pathname);
  };

  return (
    <AutoForm
      fields={[
        {
          id: "title",
          component: props => (
            <AutoFormInput label={t("create.form.title.label")} {...props} />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{
        children: t(`${data ? "edit" : "create"}.submit`),
      }}
    />
  );
};
