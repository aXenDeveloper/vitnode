"use client";

import type { ItemAutoFormComponentProps } from "@vitnode/core/components/form/auto-form";

import { AutoFormColor } from "@vitnode/core/components/form/fields/color";
import { useTranslations } from "use-intl";

export const BlogCategoryColorField = (props: ItemAutoFormComponentProps) => {
  const t = useTranslations("@vitnode/blog.admin.category");

  return (
    <AutoFormColor
      allowRemoveColor
      description={t("color.desc")}
      label={t("color.label")}
      {...props}
    />
  );
};
