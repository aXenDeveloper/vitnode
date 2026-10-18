import type { ContentFrontendPluginSource } from "@vitnode/core/lib/plugin";

import { contentTypeAdmin } from "@vitnode/core/lib/plugin";

import { manifest } from "@/manifest.gen";
import { BlogArticleEditorField } from "@/views/admin/article/editor-field";
import {
  ArticleCoverAltField,
  ArticleExcerptField,
  ArticleSlugField,
  ArticleTitleField,
} from "@/views/admin/article/editor/fields";
import { BlogArticleFormLayout } from "@/views/admin/article/form-layout";
import { BlogCategoryColorCell } from "@/views/admin/category/color-cell";
import { BlogCategoryColorField } from "@/views/admin/category/color-field";

import { blogCategoryNav, blogPostNav } from "./nav";

/**
 * The blog's AdminCP content screens, loaded from `@vitnode/blog/admin/content`
 * into the app's generated `src/content-registry.gen.ts`.
 *
 * Articles swap the generated inputs for the Tiptap editor and the AI-assisted
 * text fields, and share one custom layout between create and edit.
 * Categories get a colour picker and a colour swatch column.
 */
export const adminContent = {
  pluginId: manifest.id,
  contentTypes: [
    contentTypeAdmin({
      ...blogPostNav,
      fields: {
        // The Tiptap editor, inside the same AutoForm as everything else.
        content: { component: BlogArticleEditorField, skeleton: "editor" },
        title: { component: ArticleTitleField },
        friendlyUrl: { component: ArticleSlugField },
        excerpt: { component: ArticleExcerptField, skeleton: "textarea" },
        coverImageAlt: { component: ArticleCoverAltField },
      },
      forms: {
        // One layout for both actions - they are the same screen, and writing
        // it twice is how two screens drift apart.
        layout: BlogArticleFormLayout,
      },
    }),
    contentTypeAdmin({
      ...blogCategoryNav,
      fields: {
        color: { component: BlogCategoryColorField },
      },
      columns: {
        color: { cell: BlogCategoryColorCell },
      },
    }),
  ],
} satisfies ContentFrontendPluginSource;
