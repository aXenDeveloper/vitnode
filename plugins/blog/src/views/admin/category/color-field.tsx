"use client";

import type { ItemAutoFormComponentProps } from "@vitnode/core/components/form/auto-form";

import { AutoFormColor } from "@vitnode/core/components/form/fields/color";
import { useTranslations } from "next-intl";

/**
 * The category colour, as the AdminCP's own colour picker.
 *
 * A field override, not a new field kind: the Content Engine stores a
 * `varchar(50)` and has no opinion about what is in it, and the picker VitNode
 * already ships is what turns that into something anyone would want to use. The
 * value, the validation and the mutation are still the engine's.
 */
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
