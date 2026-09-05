import type { ContentFrontendPluginSource } from "@vitnode/core/lib/plugin";

import { contentTypeAdmin } from "@vitnode/core/lib/plugin";

import { CONFIG_PLUGIN } from "@/const";
import { BlogArticleEditorField } from "@/views/admin/article/editor-field";
import { BlogArticleFormLayout } from "@/views/admin/article/form-layout";
import { BlogCategoryColorCell } from "@/views/admin/category/color-cell";
import { BlogCategoryColorField } from "@/views/admin/category/color-field";

import { blogCategoryNav, blogPostNav } from "./nav";

export const adminContent = {
  pluginId: CONFIG_PLUGIN.pluginId,
  contentTypes: [
    contentTypeAdmin({
      ...blogPostNav,
      fields: {
        // The Tiptap editor, inside the same AutoForm as everything else.
        content: { component: BlogArticleEditorField, skeleton: "editor" },
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
