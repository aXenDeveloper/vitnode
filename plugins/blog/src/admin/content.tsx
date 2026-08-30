import type { ContentFrontendPluginSource } from "@vitnode/core/lib/plugin";

import { contentTypeAdmin } from "@vitnode/core/lib/plugin";

import { CONFIG_PLUGIN } from "@/const";
import { BlogArticleEditorField } from "@/views/admin/article/editor-field";
import { BlogArticleFormLayout } from "@/views/admin/article/form-layout";
import { BlogCategoryColorCell } from "@/views/admin/category/color-cell";
import { BlogCategoryColorField } from "@/views/admin/category/color-field";

import { blogCategoryNav, blogPostNav } from "./nav";

/**
 * The blog's Content Engine registration - two content types and four
 * overrides.
 *
 * The **browser-safe** half of the plugin's frontend integration, and the
 * canonical declaration of every override: `config.tsx` spreads this rather than
 * repeating it, so the Next.js AdminCP and the TanStack Start AdminCP render the
 * same components from the same list. There is no second copy to drift.
 *
 * Three modules, three questions:
 *
 *     admin/nav.tsx      what exists    definitions and icons
 *     admin/content.tsx  how it edits   the above, plus the overrides
 *     config.tsx         the plugin     the above, plus messages and API wiring
 *
 * Each layer spreads the one below it. `admin/nav` stays separate because
 * drawing a sidebar does not need an editor: an application that only wants
 * links imports the smaller module and never pulls this one - or Tiptap - into
 * its bundle.
 *
 * ## What an override may and may not be
 *
 * The three escape hatches, one of each kind. `fields` replaces an input,
 * `columns` replaces a table cell, and `forms.layout` replaces the arrangement
 * of a whole form - never its behaviour. The Content Engine still owns the
 * schema, the validation, the defaults, the mutation, the version precondition,
 * the structured errors, the toast and the cache invalidation.
 *
 * Everything reachable from here is framework-neutral by contract: no
 * `next/*`, no `next-intl`, no server action. `BlogArticleEditorField` draws its
 * own lazy boundary with `React.lazy`, which is what keeps the editor out of the
 * initial AdminCP bundle now that a generated registry imports this module
 * eagerly.
 */
export const adminContent = {
  pluginId: CONFIG_PLUGIN.pluginId,
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
} satisfies ContentFrontendPluginSource;
