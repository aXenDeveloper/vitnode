import { buildPlugin } from "@vitnode/core/lib/plugin";

import { adminContent } from "./admin/content";
import messages from "./locales";

/**
 * The blog's entire frontend integration.
 *
 * Two content types, three component overrides and one layout - and that is the
 * AdminCP: the nav items, the breadcrumbs, the list, the create and edit screens
 * and the delete confirmation are all generated. No page under
 * `src/routes/admin` renders a table any more, and no view calls a mutation.
 *
 * None of it is written here. `./admin/content` is the canonical declaration -
 * the content types with their overrides - and this spreads it, so the two
 * AdminCPs read one list through two doors:
 *
 *     admin/nav.tsx      browser-safe   what exists: definitions and icons
 *     admin/content.tsx  browser-safe   how it edits: fields, columns, layouts
 *     config.tsx         server         the whole plugin: the above, plus messages
 *
 * A host registers this file and walks the registry in its render
 * pass. A TanStack Start application cannot - its config is server-side on
 * purpose - so it imports `admin/content` through a generated registry of
 * literal specifiers instead. Same declarations, same components, two doors.
 */
export const blogPlugin = () =>
  buildPlugin({
    ...adminContent,
    messages,
  });
