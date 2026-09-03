import type { AdminUserSearch } from "@vitnode/core/tanstack/admin";

import { AdminShellContent } from "@vitnode/core/tanstack/admin";
import { LanguageSwitcher } from "@vitnode/core/tanstack/layout";

import { adminNav } from "#/lib/admin-nav";
import { adminUserSearchFn } from "#/lib/admin-search";
import { useAppNavigate } from "#/lib/navigation";

/**
 * The AdminCP shell, as this app mounts it.
 *
 * Everything the panel *is* - the sidebar, the header, the palette, the user
 * menu, the breadcrumb area and the one `<main>` - is `AdminShellContent`'s.
 * What is bound here is only what a package cannot answer for an application:
 *
 *     onNavigate        useAppNavigate       the palette's Enter key
 *     searchUsers       adminUserSearchFn    this app's own server function
 *     languageSwitcher  <LanguageSwitcher/>  the router's
 *     nav               adminNav             the plugins *this* app configured
 *
 * No `LinkComponent`: every sidebar destination is a route in this application's
 * own tree, so the shell's own default - `RouterLink` - is the right one. The
 * exception is handled a layer down rather than here: a plugin's `admin.nav`
 * entry may point at a docs site or a status page, and `adminLinkFor` renders
 * those as plain anchors, so an absolute URL is never handed to a router that
 * would try to match it. The sidebar and the command palette both go through it,
 * so an entry cannot behave one way when clicked and another when searched.
 *
 * `onNavigate` is still passed, because the palette moves the router *without a
 * link*: Enter on a highlighted entry is a navigation nobody clicked, and it has
 * to be handed the same de-localized destination a `<Link>` would build. See
 * `#/lib/navigation`.
 *
 * ## `nav` is a projection, not the plugin registry
 *
 * `src/vitnode.config.ts` is server-side and carries message loaders, which a
 * browser bundle has no business holding. So the sidebar is built from
 * `#/lib/admin-nav`, which reads the generated browser-safe projection: ids,
 * hrefs, permissions, icons and content type definitions, and nothing that
 * renders a screen. The screens have a projection of their own - see
 * `#/lib/content-registry`, which the content route imports so that a plugin's
 * editor fields and form layouts land in that route's chunk rather than in the
 * shell's.
 *
 * It carries the message namespaces with it, because a plugin group's headings
 * live under that plugin's own id and the shell would otherwise render them as
 * dotted identifiers. `_admin`'s loader warms the same list.
 *
 * No navigation is derived from a plugin's route tree, in either direction: the
 * navigation model is complete regardless of which screen a click lands on, and
 * a nav entry is a product decision rather than a consequence of the route tree.
 */
const searchUsers: AdminUserSearch = async search =>
  await adminUserSearchFn({ data: { search } });

export const AdminShell = ({ children }: { children: React.ReactNode }) => {
  const navigate = useAppNavigate();

  return (
    <AdminShellContent
      languageSwitcher={<LanguageSwitcher />}
      nav={adminNav}
      onNavigate={href => {
        void navigate(href);
      }}
      searchUsers={searchUsers}
    >
      {children}
    </AdminShellContent>
  );
};
