"use client";

import type { ItemAutoFormComponentProps } from "@vitnode/core/components/form/auto-form";

import { AutoFormCombobox } from "@vitnode/core/components/form/fields/combobox";
import { useLocale, useTranslations } from "next-intl";

import { loadBlogCategoryOptions } from "./category-options.server";

/**
 * The category picker, labelled in the editor's own language.
 *
 * A **label** override and nothing more: the value it stores is the identifier
 * the generated API takes, and the relation - the foreign key, the required
 * check, the refusal to delete a category that still has articles - is entirely
 * the Content Engine's. See `category-options.server.ts` for why the generated
 * picker cannot name a localized target by itself.
 */
export const BlogArticleCategoryField = (props: ItemAutoFormComponentProps) => {
  const t = useTranslations("@vitnode/blog.admin.article");
  const locale = useLocale();

  return (
    <AutoFormCombobox
      fetchData={async ({ search }) => {
        const options = await loadBlogCategoryOptions(locale);
        const term = search.trim().toLowerCase();

        // Filtered here rather than by the route: the list route searches shared
        // columns, and a category's name is not one - it is on the translation
        // table. A blog has tens of categories, not thousands.
        return term === ""
          ? options
          : options.filter(option => option.label.toLowerCase().includes(term));
      }}
      id="categoryId"
      label={t("category.label")}
      {...props}
    />
  );
};
