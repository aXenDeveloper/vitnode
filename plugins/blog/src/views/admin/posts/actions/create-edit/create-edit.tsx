import {
  AutoForm,
  type AutoFormOnSubmit,
} from "@vitnode/core/components/form/auto-form";
import { AutoFormCombobox } from "@vitnode/core/components/form/fields/combobox";
import { AutoFormEditor } from "@vitnode/core/components/form/fields/editor";
import { useDialog } from "@vitnode/core/components/ui/dialog";
import { fetcherClient } from "@vitnode/core/lib/fetcher-client";
import {
  getLangValue,
  multiLangValueSchema,
} from "@vitnode/core/lib/helpers/multi-lang";
import { usePathname, useRouter } from "@vitnode/core/lib/navigation";
import { useLocale, useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";
import { z } from "zod";

import type { zodPostSchema } from "@/api/modules/posts/routes/get.route";

import { categoriesModule } from "@/api/modules/categories/categories.module";

import { FriendlyUrlField, TitleField } from "./multi-lang-fields";
import { createMutationApi, editMutationApi } from "./mutation-api.server";

export const CreateEditActionPostsAdmin = ({
  data,
}: {
  data?: z.infer<typeof zodPostSchema> & { id?: number };
}) => {
  const t = useTranslations("@vitnode/blog.admin.posts");
  const tCore = useTranslations("core.global.errors");
  const locale = useLocale();
  const { setOpen } = useDialog();
  const { push } = useRouter();
  const pathname = usePathname();
  const resolveCategoryTitle = (
    translations: { languageCode: string; value: string }[],
  ) => getLangValue(translations, locale) || translations[0]?.value || "";
  const friendlyUrlTouchedRef = React.useRef<Set<string>>(
    new Set(data?.friendlyUrlTranslations?.map(item => item.languageCode)),
  );

  const formSchema = z.object({
    title: multiLangValueSchema({ minLength: 3, maxLength: 255 })
      .min(1)
      .default(data?.titleTranslations ?? []),
    friendlyUrl: multiLangValueSchema({ minLength: 1, maxLength: 255 })
      .min(1)
      .default(data?.friendlyUrlTranslations ?? []),
    content: multiLangValueSchema().default(data?.contentTranslations ?? []),
    categoryId: z
      .object({ value: z.string(), label: z.string() })
      .refine(value => value.value !== "", {
        message: tCore("field_required"),
      })
      .default(
        data?.category
          ? {
              value: data.category.id.toString(),
              label: resolveCategoryTitle(data.category.titleTranslations),
            }
          : { value: "", label: "" },
      ),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    form,
  ) => {
    const body = {
      title: values.title,
      content: values.content,
      friendlyUrl: values.friendlyUrl,
      categoryId: parseInt(values.categoryId.value, 10),
    };
    const mutation = data?.id
      ? await editMutationApi({ id: data.id, ...body })
      : await createMutationApi(body);

    if (mutation?.error) {
      if (mutation.error.includes("already exists")) {
        form.setError("friendlyUrl", {
          type: "manual",
          message: t("create.form.friendly_url.already_exists"),
        });

        return;
      }

      toast.error(tCore("title"), {
        description: tCore("internal_server_error"),
      });

      return;
    }

    toast.success(t(data ? "edit.success" : "create.success"));
    setOpen?.(false);
    setTimeout(() => push(pathname), 300);
  };

  return (
    <AutoForm
      fields={[
        {
          id: "title",
          component: props => (
            <TitleField
              friendlyUrlName="friendlyUrl"
              friendlyUrlTouched={friendlyUrlTouchedRef}
              label={t("create.form.title.label")}
              {...props}
            />
          ),
        },
        {
          id: "friendlyUrl",
          component: props => (
            <FriendlyUrlField
              description={t("create.form.friendly_url.desc")}
              friendlyUrlTouched={friendlyUrlTouchedRef}
              label={t("create.form.friendly_url.label")}
              {...props}
            />
          ),
        },
        {
          id: "categoryId",
          component: props => (
            <AutoFormCombobox
              fetchData={async ({ search }) => {
                const res = await fetcherClient(categoriesModule, {
                  path: "/",
                  method: "get",
                  module: "categories",
                  args: {
                    query: {
                      search,
                    },
                  },
                });
                const data = await res.json();

                return data.edges.map(category => ({
                  label: resolveCategoryTitle(category.titleTranslations),
                  value: category.id.toString(),
                }));
              }}
              id="categoryId"
              label={t("create.form.category")}
              {...props}
            />
          ),
        },
        {
          id: "content",
          component: props => (
            <AutoFormEditor
              label={t("create.form.content")}
              multiLang
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
