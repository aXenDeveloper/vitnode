import { definePluginRoute } from "@vitnode/core/routing";
import { useTranslations } from "use-intl";

/**
 * A plugin page inside the AdminCP - `area: "admin"`, and the smallest real one
 * that can be written.
 *
 * It exists to prove the runtime rather than to do a job: a declaration in
 * `routes/manifest.ts` becomes a generated manifest entry, a generated literal
 * `import()`, a route mounted under the host's `_admin` shell, and a URL at
 * `/admin/example` with the sidebar, the breadcrumb and the admin session guard
 * around it. Nothing about the page itself is special, which is the point - the
 * contract is the same one a public page has.
 *
 * ## What is *not* here
 *
 * **A framework.** The same two imports a public plugin page has: the routing
 * package, which is data and types with no framework in it, and `use-intl`,
 * which VitNode itself renders through. No router, no `next/*`, no host-specific
 * module - so this file is renderable by whichever application installs the
 * plugin.
 *
 * **A `<main>`.** `area: "admin"` puts this inside the AdminCP shell, and the
 * shell's `SidebarInset` *is* the document's one `<main>`. A page that rendered
 * its own would produce two landmarks for a screen reader to choose between.
 *
 * **A permission gate.** This page shows nothing an administrator may not see,
 * and the example plugin has no staff permission that would honestly describe
 * "may open the overview" - its only permission modules are its two content
 * types. Inventing one would be a security relationship that does not exist. A
 * plugin page that *does* hold privileged data gates its own content with
 * `AdminStaffPermissionGate` and, more importantly, is refused by the API:
 * `requires` is not the tool, because it is about the public session and the
 * AdminCP runs on its own.
 */
const AdminExamplePage = () => {
  const t = useTranslations("@vitnode/example.admin.overview");

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {t("title")}
        </h1>

        <p className="text-muted-foreground leading-relaxed text-pretty">
          {t("desc")}
        </p>
      </header>

      <ul className="text-muted-foreground flex list-disc flex-col gap-2 pl-5 leading-relaxed">
        <li>{t("points.shell")}</li>
        <li>{t("points.path")}</li>
        <li>{t("points.nav")}</li>
      </ul>
    </div>
  );
};

/**
 * The crumb the AdminCP header renders for this page.
 *
 * Owned by the plugin, exactly as a public plugin route's is: the deepest
 * matched route that declares one wins, and the host's shell mounts whatever it
 * finds. Text rather than a link - a locale-correct href needs the host's own
 * link component, and a plugin route module is handed nothing to build one with.
 */
const AdminExampleBreadcrumb = () => {
  const t = useTranslations("@vitnode/example.admin.overview");

  return <span>{t("title")}</span>;
};

export const route = definePluginRoute({
  breadcrumb: AdminExampleBreadcrumb,
  // Inherited from the host's `_admin` route, which declares it once for the
  // whole panel - restated here because a plugin cannot rely on an application
  // having done so, and an AdminCP page must never be indexed.
  head: () => ({ robots: "noindex, nofollow" }),
});

export default AdminExamplePage;
