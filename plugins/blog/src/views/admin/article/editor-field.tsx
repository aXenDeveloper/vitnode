"use client";

import type { ItemAutoFormComponentProps } from "@vitnode/core/components/form/auto-form";

import { Loader } from "@vitnode/core/components/ui/loader";
import React from "react";
import { useTranslations } from "use-intl";

/**
 * The rich-text editor, behind its own lazy boundary.
 *
 * `React.lazy` rather than `next/dynamic`, and that is what makes this field
 * usable from both AdminCPs: the Next.js one and the TanStack Start one. The two
 * behave the same here - one chunk, fetched when the field first renders - and
 * only one of them exists outside Next.
 *
 * The boundary matters more than which API draws it. Tiptap and its extensions
 * are the single largest thing the blog contributes to a bundle, and this keeps
 * them out of every screen that is not the article form, including the article
 * *list* that sits one navigation away. That is why the plugin owns the split
 * rather than leaving it to whatever imports the registration: an application's
 * generated content registry imports this module eagerly, and what it gets is a
 * label and a `lazy()` call.
 *
 * No `ssr: false` counterpart is needed. `components/ui/editor` already creates
 * the editor with `immediatelyRender: false`, which is Tiptap's own answer to
 * server rendering, so the fallback below is the whole of the loading state.
 */
const AutoFormEditor = React.lazy(
  async () =>
    await import("@vitnode/core/components/form/fields/editor").then(mod => ({
      default: mod.AutoFormEditor,
    })),
);

export const BlogArticleEditorField = (props: ItemAutoFormComponentProps) => {
  const t = useTranslations("@vitnode/blog.admin.article");

  return (
    <React.Suspense fallback={<Loader />}>
      <AutoFormEditor label={t("content.label")} {...props} />
    </React.Suspense>
  );
};
