"use client";

import { useTranslations } from "use-intl";

/**
 * The data table's default empty state.
 *
 * Two strings, and its own `"use client"` module for one reason:
 * {@link ContentDataTable} is rendered as a *Server Component* by every AdminCP
 * page - `DataTable` has no client boundary of its own, so React renders the
 * table on the server and only its controls in the browser - and as an ordinary
 * client component by `apps/web`, which has no server components at all. It is
 * therefore the one shared component in this package that cannot read a React
 * context, because in half its callers there is no context to read.
 *
 * `next-intl` used to paper over that: its root entry resolves to an
 * RSC-capable `useTranslations` under Next's `react-server` condition and to
 * the context-reading one everywhere else. That works, and it is the only
 * reason the table translated in both places - but it is also the last thing
 * tying a shared component to Next.js, and it hid the fact that the table
 * renders in two different environments.
 *
 * So the translating moved here instead, behind a boundary that is a client
 * component in both frameworks. A caller that already has the copy passes
 * `customNoResults` and this renders its strings without looking anything up.
 */
export const NoResultsDataTable = ({
  description,
  title,
}: {
  description?: string;
  title?: string;
}) => {
  const t = useTranslations("core.global.no_results");

  return (
    <>
      <h3 className="text-xl font-semibold tracking-tight">
        {title ?? t("title")}
      </h3>
      <p className="text-muted-foreground text-sm">
        {description ?? t("desc")}
      </p>
    </>
  );
};
