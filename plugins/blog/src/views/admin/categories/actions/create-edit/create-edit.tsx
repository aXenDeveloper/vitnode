import {
  AutoForm,
  type AutoFormOnSubmit,
} from "@vitnode/core/components/form/auto-form";
import { AutoFormColor } from "@vitnode/core/components/form/fields/color";
import { AutoFormInput } from "@vitnode/core/components/form/fields/input";
import { useDialog } from "@vitnode/core/components/ui/dialog";
import {
  getLangValue,
  multiLangValueSchema,
} from "@vitnode/core/lib/helpers/multi-lang";
import { usePathname, useRouter } from "@vitnode/core/lib/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";

import type { zodCategorySchema } from "@/api/modules/categories/routes/get.route";

import { createMutationApi, editMutationApi } from "./mutation-api.server";

export const CreateEditActionCategoriesAdmin = ({
  data,
}: {
  data?: z.infer<typeof zodCategorySchema> & { id: number };
}) => {
  const t = useTranslations("@vitnode/blog.admin.categories");
  const tCore = useTranslations("core.global.errors");
  const { setOpen } = useDialog();
  const { push } = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const formSchema = z.object({
    title: multiLangValueSchema({ minLength: 1, maxLength: 100 })
      .min(1)
      .default(data?.titleTranslations ?? []),
    color: z.string().default(data?.color ?? ""),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const mutation = data?.id
      ? await editMutationApi({ id: data.id, ...values })
      : await createMutationApi(values);

    if (mutation?.error) {
      toast.error(tCore("title"), {
        description: tCore("internal_server_error"),
      });

      return;
    }

    toast.success(t(data ? "edit.success" : "create.success"), {
      description: getLangValue(values.title, locale) || values.title[0]?.value,
    });
    setOpen?.(false);
    push(pathname);
  };

  return (
    <AutoForm
      fields={[
        {
          id: "title",
          component: props => (
            <AutoFormInput
              label={t("create.form.title.label")}
              multiLang
              {...props}
            />
          ),
        },
        {
          id: "color",
          component: props => (
            <AutoFormColor
              allowRemoveColor
              label={t("create.form.color")}
              {...props}
            />
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
