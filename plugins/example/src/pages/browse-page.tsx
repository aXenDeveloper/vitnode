import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { definePluginRoute } from "@vitnode/core/routing";
import { useTranslations } from "use-intl";

import type { BrowseSearch } from "./browse-search";

import { BROWSE_LAST_PAGE, BROWSE_PAGE_SIZE } from "./browse-search";

const ITEMS = [
  "pages",
  "layouts",
  "index routes",
  "messages",
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

export const route = definePluginRoute({
  head: () => ({ title: "Browse" }),

  breadcrumb: false,
});

export default BrowsePage;
