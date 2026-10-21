import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import { ContentListResults } from "@vitnode/core/tanstack/content";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { useLocale, useTranslations } from "use-intl";

import { DISCUSSIONS_HREF, discussionsQueryOptions } from "./discussion-list";
import { discussionHref } from "./discussion-search";

/**
 * The five newest discussions, for any page. Shares its cache entry with the
 * first page of `/discussions`, so warming either warms both.
 */
export const LatestDiscussions = () => {
  const t = useTranslations("@vitnode/example.boards.latest");
  const locale = useLocale();
  const { data, isError, isFetching } = useQuery(
    discussionsQueryOptions({ locale, search: {} }),
  );

  return (
    <section
      aria-labelledby="latest-discussions"
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-4">
        <h2
          className="text-foreground text-xl font-semibold text-balance"
          id="latest-discussions"
        >
          {t("title")}
        </h2>
        <HrefLink
          className={buttonVariants({ size: "sm", variant: "ghost" })}
          href={DISCUSSIONS_HREF}
        >
          {t("all")}
        </HrefLink>
      </div>
      <ContentListResults
        className="flex flex-col divide-y rounded-lg border"
        empty={
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("empty")}
          </p>
        }
        error={
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("error")}
          </p>
        }
        getKey={discussion => discussion.id}
        isError={isError}
        isFetching={isFetching}
        isFiltered={false}
        itemClassName="px-4 py-3"
        items={data?.edges.slice(0, 5)}
        label={t("title")}
        loading={
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("loading")}
          </p>
        }
        noResults={null}
        renderItem={discussion =>
          discussion.slug === null ? (
            <span className="text-foreground font-medium">
              {discussion.title}
            </span>
          ) : (
            <HrefLink
              className="text-foreground font-medium hover:underline"
              href={discussionHref(discussion.slug)}
            >
              {discussion.title}
            </HrefLink>
          )
        }
      />
    </section>
  );
};
