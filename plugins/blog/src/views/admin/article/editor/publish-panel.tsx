import type { ContentFileFieldValue } from "@vitnode/core/content/files";

import { Button } from "@vitnode/core/components/ui/button";
import { getLangValue } from "@vitnode/core/lib/helpers/multi-lang";
import { cn } from "cn";
import { CircleAlertIcon, CircleCheckIcon, SparklesIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import {
  type ArticleCheck,
  type ArticleValues,
  fieldText,
  RECOMMENDED_LENGTH,
} from "./readiness";

export interface CheckAction {
  ai?: boolean;
  label: string;
  run: () => void;
}

const CheckRow = ({
  actions,
  detail,
  label,
  ok,
}: {
  actions?: CheckAction[];
  detail?: React.ReactNode;
  label: string;
  ok: boolean;
}) => (
  <li className="flex gap-2 py-1.5">
    {ok ? (
      <CircleCheckIcon
        aria-hidden
        className="text-success mt-0.5 size-4 shrink-0"
      />
    ) : (
      <CircleAlertIcon
        aria-hidden
        className="text-warn mt-0.5 size-4 shrink-0"
      />
    )}
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-sm">{label}</span>
      {!ok && detail ? (
        <span className="text-muted-foreground text-xs leading-relaxed text-pretty">
          {detail}
        </span>
      ) : null}
      {!ok && actions?.length ? (
        <div className="-ms-2 flex flex-wrap gap-1">
          {actions.map(action => (
            <Button
              className={cn(action.ai && "text-primary")}
              key={action.label}
              onClick={action.run}
              size="xs"
              type="button"
              variant="ghost"
            >
              {action.ai ? <SparklesIcon /> : null}
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  </li>
);

export const ReadinessList = ({
  actionsFor,
  checks,
  languageName,
  sourceName,
}: {
  actionsFor: (check: ArticleCheck) => CheckAction[];
  checks: ArticleCheck[];
  languageName: (code: string) => string;
  sourceName: string;
}) => {
  const t = useTranslations("@vitnode/blog.admin.article.editor.publish");
  const done = checks.filter(check => check.ok).length;
  const list = (codes: readonly string[]) => codes.map(languageName).join(", ");

  const detailOf = (check: ArticleCheck): React.ReactNode => {
    switch (check.id) {
      case "alt":
        return t("checks.alt_detail", { languages: list(check.missing) });
      case "cover":
        return t("checks.cover_detail");
      case "excerpt":
        return t("checks.excerpt_detail", { languages: list(check.missing) });
      case "outdated":
        return t("checks.outdated_detail", {
          languages: list(check.outdated),
          source: sourceName,
        });
      case "title":
        return t("checks.title_detail", {
          languages: list(check.tooLong),
          max: RECOMMENDED_LENGTH.title,
        });
      case "translations":
        return (
          <span className="flex flex-col">
            {Object.entries(check.missing).map(([code, count]) => (
              <span key={code}>
                {t("checks.translations_detail", {
                  count,
                  language: languageName(code),
                })}
              </span>
            ))}
          </span>
        );
    }
  };

  return (
    <section aria-labelledby="article-ready" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" id="article-ready">
          {t("title")}
        </h2>
        <span className="text-muted-foreground text-xs tabular-nums">
          {done}/{checks.length}
        </span>
      </div>
      <div
        aria-label={t("title")}
        aria-valuemax={checks.length}
        aria-valuemin={0}
        aria-valuenow={done}
        className="bg-muted h-1 overflow-hidden rounded-full"
        role="progressbar"
      >
        <div
          className="bg-success h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${(done / checks.length) * 100}%` }}
        />
      </div>
      <ul className="flex flex-col">
        {checks.map(check => (
          <CheckRow
            actions={actionsFor(check)}
            detail={detailOf(check)}
            key={check.id}
            label={t(`checks.${check.id}`)}
            ok={check.ok}
          />
        ))}
      </ul>
    </section>
  );
};

const subscribeNever = () => () => {};

const coverUrlOf = (
  value: unknown,
  file: ContentFileFieldValue | undefined,
): null | string => {
  if (!file || Array.isArray(file)) return null;

  return file.id === value ? file.url : null;
};

export const Previews = ({
  cover,
  languages,
  source,
  values,
}: {
  cover: ContentFileFieldValue | undefined;
  languages: { code: string; name: string }[];
  source: string;
  values: ArticleValues;
}) => {
  const t = useTranslations(
    "@vitnode/blog.admin.article.editor.publish.previews",
  );
  const [locale, setLocale] = React.useState(source);
  const pick = (field: "excerpt" | "friendlyUrl" | "title") => {
    const own = getLangValue(values[field], locale).trim();

    return own
      ? { fallback: false, text: own }
      : {
          fallback: locale !== source,
          text: getLangValue(values[field], source),
        };
  };
  const title = pick("title");
  const slug = pick("friendlyUrl");
  const excerpt = pick("excerpt");
  const description =
    excerpt.text.trim() ||
    (
      fieldText(values, "content", locale) ||
      fieldText(values, "content", source)
    )
      .replace(/\s+/g, " ")
      .slice(0, RECOMMENDED_LENGTH.excerpt);
  const searchTitle =
    title.text.length > RECOMMENDED_LENGTH.title
      ? `${title.text.slice(0, RECOMMENDED_LENGTH.title - 1).trimEnd()}…`
      : title.text;
  const coverUrl = coverUrlOf(values.coverImage, cover);
  const host = React.useSyncExternalStore(
    subscribeNever,
    () => window.location.host,
    () => "",
  );
  const sourceName =
    languages.find(language => language.code === source)?.name ?? source;
  const fallbacks = [title, slug, excerpt].some(item => item.fallback);

  return (
    <section aria-labelledby="article-previews" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold" id="article-previews">
          {t("title")}
        </h2>
        {languages.length > 1 ? (
          <div
            aria-label={t("language")}
            className="bg-muted flex gap-0.5 rounded-md p-0.5"
            role="radiogroup"
          >
            {languages.map(language => (
              <button
                aria-checked={locale === language.code}
                aria-label={language.name}
                className={cn(
                  "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 relative h-6 rounded-sm px-2 text-xs font-medium uppercase transition-[color,background-color,box-shadow] duration-150 ease-out outline-none before:absolute before:inset-x-0 before:-inset-y-2 focus-visible:ring-3 motion-reduce:transition-none",
                  locale === language.code &&
                    "bg-card text-foreground shadow-xs",
                )}
                key={language.code}
                onClick={() => {
                  setLocale(language.code);
                }}
                role="radio"
                type="button"
              >
                {language.code}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {fallbacks ? (
        <p className="text-warn text-xs leading-relaxed text-pretty">
          {t("fallback", {
            language:
              languages.find(language => language.code === locale)?.name ??
              locale,
            source: sourceName,
          })}
        </p>
      ) : null}

      <figure className="flex flex-col gap-1">
        <figcaption className="text-muted-foreground text-xs">
          {t("search")}
        </figcaption>
        <div className="bg-card flex flex-col gap-1 rounded-lg p-3 shadow-xs ring-1 ring-black/8 dark:ring-white/10">
          <span className="text-muted-foreground truncate text-xs">
            {[host, locale === source ? null : locale, "blog", slug.text]
              .filter(Boolean)
              .join(" › ")}
          </span>
          <span className="text-primary text-base leading-snug">
            {searchTitle}
          </span>
          <span className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
            {description}
          </span>
        </div>
      </figure>

      <figure className="flex flex-col gap-1">
        <figcaption className="text-muted-foreground text-xs">
          {t("social")}
        </figcaption>
        <div className="bg-card overflow-hidden rounded-lg shadow-xs ring-1 ring-black/8 dark:ring-white/10">
          {coverUrl ? (
            <img
              alt=""
              className="aspect-[1.91/1] w-full object-cover"
              decoding="async"
              height={420}
              loading="lazy"
              src={coverUrl}
              width={800}
            />
          ) : (
            <div className="bg-muted text-muted-foreground grid aspect-[1.91/1] place-items-center px-6 text-center text-xs leading-relaxed text-pretty">
              {t("no_cover")}
            </div>
          )}
          <div className="flex flex-col gap-0.5 p-3">
            <span className="text-muted-foreground text-xs">{host}</span>
            <span className="line-clamp-2 text-sm font-medium">
              {title.text}
            </span>
          </div>
        </div>
      </figure>
    </section>
  );
};
