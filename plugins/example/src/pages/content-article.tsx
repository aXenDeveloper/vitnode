import { DateFormat } from "@vitnode/core/components/date-format";
import { useTranslations } from "use-intl";

export const ContentArticle = ({
  children,
  lang,
  lead,
  publishedAt,
  title,
}: {
  children?: React.ReactNode;
  lang?: string;
  lead?: null | string;
  publishedAt: null | string;
  title: string;
}) => {
  const t = useTranslations("@vitnode/example.articles");

  return (
    <article
      className="container mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:gap-8 md:py-12"
      lang={lang}
    >
      <header className="flex flex-col gap-3">
        {publishedAt ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("published")}{" "}
            <time dateTime={new Date(publishedAt).toISOString()}>
              <DateFormat date={publishedAt} showFullDate />
            </time>
          </p>
        ) : null}

        <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          {title}
        </h1>

        {lead ? (
          <p className="text-muted-foreground text-lg leading-relaxed text-pretty">
            {lead}
          </p>
        ) : null}
      </header>

      {children}
    </article>
  );
};
