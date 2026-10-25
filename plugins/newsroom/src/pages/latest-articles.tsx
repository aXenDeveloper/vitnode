import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@vitnode/core/components/ui/skeleton";
import { ContentListResults } from "@vitnode/core/tanstack/content";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { useLocale, useTranslations } from "use-intl";

import { articlesQueryOptions } from "./article-list";

/** How many articles the box shows, out of the first page of `/news`. */
const LATEST_COUNT = 5;

/** The newest published articles, without the one being read. */
export const LatestArticles = ({ currentId }: { currentId?: number }) => {
  const t = useTranslations("newsroom.articles.latest");
  const locale = useLocale();
  const { data, isError, isFetching } = useQuery(
    articlesQueryOptions({ locale, search: {} }),
  );
  const items = data?.edges
    .filter(article => article.id !== currentId)
    .slice(0, LATEST_COUNT);

  return (
    <section aria-labelledby="latest-articles" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-balance" id="latest-articles">
          {t("title")}
        </h2>
        <HrefLink className="text-sm font-medium hover:underline" href="/news">
          {t("all")}
        </HrefLink>
      </div>

      <ContentListResults
        className="flex flex-col divide-y rounded-lg border"
        empty={<p className="text-muted-foreground text-sm">{t("empty")}</p>}
        error={<p className="text-muted-foreground text-sm">{t("error")}</p>}
        getKey={article => article.id}
        isError={isError}
        isFetching={isFetching}
        isFiltered={false}
        itemClassName="px-4 py-3"
        items={items}
        label={t("title")}
        loading={
          <div
            aria-busy="true"
            className="flex flex-col gap-3 rounded-lg border p-4"
          >
            <span className="sr-only" role="status">
              {t("loading")}
            </span>
            {[0, 1, 2].map(key => (
              <Skeleton className="h-5 w-2/3" key={key} />
            ))}
          </div>
        }
        noResults={null}
        renderItem={article => (
          <HrefLink
            className="font-medium hover:underline"
            href={`/news/${article.slug}`}
          >
            {article.title}
          </HrefLink>
        )}
      />
    </section>
  );
};
