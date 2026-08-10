import { buildPlugin, contentTypeAdmin } from "@vitnode/core/lib/plugin";
import { ListIcon, NotebookPenIcon } from "lucide-react";

import { CONFIG_PLUGIN } from "@/const";
import { blogCategoryContentType } from "@/content/category";
import { blogPostContentType } from "@/content/post";
import { BlogArticleEditorField } from "@/views/admin/article/editor-field";
import { BlogArticleFormLayout } from "@/views/admin/article/form-layout";
import { BlogCategoryColorCell } from "@/views/admin/category/color-cell";
import { BlogCategoryColorField } from "@/views/admin/category/color-field";

import messages from "./locales";

/**
 * The blog's entire frontend integration.
 *
 * Two content types, three component overrides and one layout - and that is the
 * AdminCP: the nav items, the breadcrumbs, the list, the create and edit screens
 * and the delete confirmation are all generated. No page under
 * `src/routes/admin` renders a table any more, and no view calls a mutation.
 *
 * The overrides are the two escape hatches, one of each kind. `fields` replaces
 * an input, `columns` replaces a table cell, and `forms.layout` replaces the
 * arrangement of a whole form - never its behaviour.
 */
export const blogPlugin = () => {
  return buildPlugin({
    pluginId: CONFIG_PLUGIN.pluginId,
    messages,
    contentTypes: [
      contentTypeAdmin({
        definition: blogPostContentType,
        icon: <NotebookPenIcon />,
        fields: {
          // The Tiptap editor, inside the same AutoForm as everything else.
          content: { component: BlogArticleEditorField },
        },
        forms: {
          // One layout for both actions - they are the same screen, and writing
          // it twice is how two screens drift apart.
          layout: BlogArticleFormLayout,
        },
      }),
      contentTypeAdmin({
        definition: blogCategoryContentType,
        icon: <ListIcon />,
        fields: {
          color: { component: BlogCategoryColorField },
        },
        columns: {
          color: { cell: BlogCategoryColorCell },
        },
      }),
    ],
  });
};
