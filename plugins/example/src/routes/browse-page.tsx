import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { definePluginRoute } from "@vitnode/core/routing";
import { useTranslations } from "use-intl";

import type { BrowseSearch } from "./browse-page.search";

import { BROWSE_LAST_PAGE, BROWSE_PAGE_SIZE } from "./browse-page.search";

/**
 * A page whose URL *is* its state, and the reason a route may declare a
 * `searchEntry`.
 *
 * Its twin is `guide-topic-page.tsx`, which reads its query string through the
 * module's own lazy `parseSearch`. That is the right default and covers most
 * pages: a parameter the page reads, normalised once the chunk has arrived.
 *
 * This one cannot use it. The page number is not something the page reads *about*
 * itself - it decides which page exists at all, so it has to be validated before
 * the router matches, not after. Declaring `searchEntry` in the manifest is what
 * buys that: `./browse-page.search` is imported statically, the router gets a
 * real `validateSearch`, and `?page=999` is clamped to the last real page before
 * anything renders. The page module itself stays in its own chunk.
 *
 * What that changes here, all of it visible in the props:
 *
 * - `search` is the schema's own type rather than "whatever survived", so
 *   `search.page` is a number and there is nothing to guard.
 * - `navigate` changes the query string of the URL the page is already on. It is
 *   the whole of the navigation a plugin is offered, deliberately: a plugin
 *   handed a router's own `navigate` would be handed that router's route table
 *   with it.
 */
const ITEMS = [
  "entries",
  "manifests",
  "namespaces",
  "layouts",
  "breadcrumbs",
  "loaders",
  "metadata",
  "search",
  "guards",
];

const BrowsePage = ({
  navigate,
  search,
}: PluginRoutePageProps<undefined, BrowseSearch>) => {
  const t = useTranslations("@vitnode/example.browse");
  const start = (search.page - 1) * BROWSE_PAGE_SIZE;
  const shown = ITEMS.slice(start, start + BROWSE_PAGE_SIZE);

  return (
    <div className="container mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        {t("title")}
      </h1>

      <p className="text-muted-foreground leading-relaxed text-pretty">
        {t("desc")}
      </p>

      <ul className="flex flex-col gap-2">
        {shown.map(item => (
          <li
            className="rounded-md border px-3 py-2 leading-relaxed"
            key={item}
          >
            {item}
          </li>
        ))}
      </ul>

      <nav aria-label={t("pagination")} className="flex items-center gap-2">
        <button
          className="rounded-md border px-3 py-2 disabled:opacity-50"
          disabled={search.page <= 1}
          onClick={() => {
            void navigate({
              resetScroll: false,
              search: { page: search.page - 1 },
            });
          }}
          type="button"
        >
          {t("previous")}
        </button>

        <span aria-live="polite" className="text-sm leading-relaxed">
          {t("page", { of: BROWSE_LAST_PAGE, page: search.page })}
        </span>

        <button
          className="rounded-md border px-3 py-2 disabled:opacity-50"
          disabled={search.page >= BROWSE_LAST_PAGE}
          onClick={() => {
            void navigate({
              resetScroll: false,
              search: { page: search.page + 1 },
            });
          }}
          type="button"
        >
          {t("next")}
        </button>
      </nav>
    </div>
  );
};

/**
 * No `parseSearch` here, and that is not an omission.
 *
 * A route with a `searchEntry` has already had its query string validated by the
 * router, and the runtime hands that value straight through - so a `parseSearch`
 * beside it would normalise a normalised value, with the module's answer
 * silently disagreeing with the one the router built its links and its match id
 * from. One route, one search contract.
 */
export const route = definePluginRoute({
  head: () => ({ title: "Browse" }),
});

export default BrowsePage;
