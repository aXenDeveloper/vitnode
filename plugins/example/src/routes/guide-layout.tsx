import { definePluginRoute } from "@vitnode/core/routing";
import { useTranslations } from "use-intl";

/**
 * The frame `routes/manifest.ts` declares as `kind: "layout"`.
 *
 * A layout claims no URL of its own. It is only ever reached through one of its
 * children, which is why the manifest rejects one with no children, and why the
 * index page beside it - `guide-index-page` - is a separate route at the same
 * path rather than something this file renders itself.
 *
 * `children` arrives as a **prop**, not as an `<Outlet />` this module imports,
 * and that is the one thing keeping a plugin layout framework-neutral: an
 * `Outlet` belongs to a router, and a plugin that imported one could be
 * installed into exactly one kind of application. It is also the same shape as a
 * Next.js `layout.tsx`, so a plugin that ships both writes the frame once.
 *
 * Two imports, and both are deliberate. `@vitnode/core/routing` is data and
 * types only - it is the same module a Node build reads, with no framework in
 * it. `use-intl` is the library VitNode itself renders through; a plugin that
 * reached for `next-intl` or a router's hooks instead would pin itself to one
 * host.
 */
const GuideLayout = ({ children }: { children: React.ReactNode }) => {
  const t = useTranslations("@vitnode/example.guide");

  return (
    <div className="container mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {t("title")}
        </h1>

        <p className="text-muted-foreground leading-relaxed text-pretty">
          {t("desc")}
        </p>
      </header>

      {children}
    </div>
  );
};

/**
 * The crumb every page under this frame shows, unless one of them declares its
 * own.
 *
 * A component rather than an element, because the label is translated and so has
 * to be able to call a hook - and because the runtime is the only thing that
 * knows where in the shell to mount it. The deepest matched route that declares
 * one wins, which is the same rule the host's own routes follow.
 *
 * Text, not a link: building a locale-correct href needs the host's own link
 * component, and a plugin route module is handed nothing to build one with.
 */
const GuideBreadcrumb = () => {
  const t = useTranslations("@vitnode/example.guide");

  return <span>{t("title")}</span>;
};

/**
 * What this frame contributes to every page inside it.
 *
 * `head` is merged down the matched routes and the deepest wins per field, so
 * declaring `robots` here is how the whole subtree inherits it by saying
 * nothing. A child that needs a different directive overrides just that field.
 *
 * `definePluginRoute` rather than a `satisfies` clause: it infers the types this
 * object's own members share. Nothing on this layout needs that yet - it is used
 * here for the same reason the child below uses it, which is that there is one
 * way to write a `route` export and not two.
 */
export const route = definePluginRoute({
  head: () => ({ robots: "index, follow" }),
  breadcrumb: GuideBreadcrumb,
});

export default GuideLayout;
