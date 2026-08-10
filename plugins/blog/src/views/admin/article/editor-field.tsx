"use client";

import type { ItemAutoFormComponentProps } from "@vitnode/core/components/form/auto-form";

import { Loader } from "@vitnode/core/components/ui/loader";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import React from "react";

/**
 * The rich text editor, loaded on demand.
 *
 * `AutoFormEditor` pulls in the whole Tiptap stack, which is the single heaviest
 * thing on the article screen and useless on every other one - so it arrives with
 * the editor tab rather than with the page. `ssr: false` because the editor
 * mounts against a real DOM; rendering it on the server and again in the browser
 * is exactly the hydration mismatch that makes an editor drop its first
 * keystroke.
 */
const AutoFormEditor = dynamic(
  async () =>
    await import("@vitnode/core/components/form/fields/editor").then(mod => ({
      default: mod.AutoFormEditor,
    })),
  { loading: () => <Loader />, ssr: false },
);

/**
 * The article body.
 *
 * A field override, so the editor is one input inside the **same** form as the
 * title, the slug, the category and the author: one `react-hook-form` instance,
 * one schema, one submit. There is no editor-local state atom and no second save
 * button - `field.value` and `field.onChange` are the whole integration, and
 * dirty state and validation work because of it.
 */
export const BlogArticleEditorField = (props: ItemAutoFormComponentProps) => {
  const t = useTranslations("@vitnode/blog.admin.article");

  return (
    <React.Suspense fallback={<Loader />}>
      <AutoFormEditor label={t("content.label")} {...props} />
    </React.Suspense>
  );
};
