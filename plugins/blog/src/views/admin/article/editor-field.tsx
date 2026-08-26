"use client";

import type { ItemAutoFormComponentProps } from "@vitnode/core/components/form/auto-form";

import { Loader } from "@vitnode/core/components/ui/loader";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import React from "react";

const AutoFormEditor = dynamic(
  async () =>
    await import("@vitnode/core/components/form/fields/editor").then(mod => ({
      default: mod.AutoFormEditor,
    })),
  { loading: () => <Loader />, ssr: false },
);

export const BlogArticleEditorField = (props: ItemAutoFormComponentProps) => {
  const t = useTranslations("@vitnode/blog.admin.article");

  return (
    <React.Suspense fallback={<Loader />}>
      <AutoFormEditor label={t("content.label")} {...props} />
    </React.Suspense>
  );
};
