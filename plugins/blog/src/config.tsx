import { buildPlugin, contentTypeAdmin } from "@vitnode/core/lib/plugin";

import { CONFIG_PLUGIN } from "@/const";
import { BlogArticleEditorField } from "@/views/admin/article/editor-field";
import { BlogArticleFormLayout } from "@/views/admin/article/form-layout";
import { BlogCategoryColorCell } from "@/views/admin/category/color-cell";
import { BlogCategoryColorField } from "@/views/admin/category/color-field";

import { blogCategoryNav, blogPostNav } from "./admin/nav";
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
 *
 * What each content type *is* - its definition and its sidebar icon - is spread
 * in from `./admin/nav` rather than written here. That module is browser-safe
 * and is what an application which cannot import this file reads to draw the
 * blog's sidebar entries; keeping the pairs there and the overrides here is what
 * stops the two AdminCPs disagreeing about which icon a screen has.
 */
export const blogPlugin = () => {
  return buildPlugin({
    pluginId: CONFIG_PLUGIN.pluginId,
    messages,
    contentTypes: [
      contentTypeAdmin({
        ...blogPostNav,
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
        ...blogCategoryNav,
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
