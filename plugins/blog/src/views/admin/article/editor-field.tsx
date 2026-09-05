"use client";

import type { ItemAutoFormComponentProps } from "@vitnode/core/components/form/auto-form";

import { ContentFormFieldSkeleton } from "@vitnode/core/content/admin-form";
import React from "react";
import { useTranslations } from "use-intl";

const AutoFormEditor = React.lazy(
  async () =>
    await import("@vitnode/core/components/form/fields/editor").then(mod => ({
      default: mod.AutoFormEditor,
    })),
);

export const BlogArticleEditorField = (props: ItemAutoFormComponentProps) => {
  const t = useTranslations("@vitnode/blog.admin.article");

  return (
    <React.Suspense fallback={<ContentFormFieldSkeleton control="editor" />}>
      <AutoFormEditor label={t("content.label")} {...props} />
    </React.Suspense>
  );
};
