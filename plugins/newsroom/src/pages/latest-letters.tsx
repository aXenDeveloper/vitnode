import { useQuery } from "@tanstack/react-query";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import { ContentListResults } from "@vitnode/core/tanstack/content";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { useLocale, useTranslations } from "use-intl";

import { LETTERS_HREF, lettersQueryOptions } from "./letter-list";
import { letterHref } from "./letter-search";

/**
 * The five newest letters, for any page. Shares its cache entry with the
 * first page of `/letters`, so warming either warms both.
 */
export const LatestLetters = () => {
  const t = useTranslations("newsroom.desks.latest");
  const locale = useLocale();
  const { data, isError, isFetching } = useQuery(
    lettersQueryOptions({ locale, search: {} }),
  );

  return (
    <section aria-labelledby="latest-letters" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2
          className="text-foreground text-xl font-semibold text-balance"
          id="latest-letters"
        >
          {t("title")}
        </h2>
        <HrefLink
          className={buttonVariants({ size: "sm", variant: "ghost" })}
          href={LETTERS_HREF}
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
        getKey={letter => letter.id}
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
        renderItem={letter =>
          letter.slug === null ? (
            <span className="text-foreground font-medium">{letter.title}</span>
          ) : (
            <HrefLink
              className="text-foreground font-medium hover:underline"
              href={letterHref(letter.slug)}
            >
              {letter.title}
            </HrefLink>
          )
        }
      />
    </section>
  );
};
