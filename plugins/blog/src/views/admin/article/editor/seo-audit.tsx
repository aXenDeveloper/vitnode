import type { ContentFileFieldValue } from "@vitnode/core/content/files";

import { getLangValue } from "@vitnode/core/lib/helpers/multi-lang";
import { cn } from "cn";
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { CharacterCount } from "./fields";
import {
  type ArticleCheck,
  type ArticleValues,
  RECOMMENDED_LENGTH,
} from "./readiness";
import {
  type CheckAction,
  CheckActions,
  coverUrlOf,
  useCheckDetail,
} from "./readiness-actions";

const Segments = ({ done, total }: { done: number; total: number }) => (
  <div aria-hidden className="flex gap-1">
    {Array.from({ length: total }, (_, index) => (
      <span
        className={cn(
          "h-1.5 flex-1 rounded-full transition-colors duration-200 ease-out motion-reduce:transition-none",
          index < done ? "bg-success" : "bg-muted",
        )}
        key={index}
      />
    ))}
  </div>
);

const LengthMeter = ({ max, value }: { max: number; value: string }) => (
  <div aria-hidden className="bg-muted h-1 flex-1 overflow-hidden rounded-full">
    <div
      className={cn(
        "h-full rounded-full transition-[width] duration-200 ease-out motion-reduce:transition-none",
        value.length > max ? "bg-warn" : "bg-success",
      )}
      style={{ width: `${Math.min(value.length / max, 1) * 100}%` }}
    />
  </div>
);

const AuditRow = ({
  children,
  label,
  ok,
}: {
  children: React.ReactNode;
  label?: string;
  ok: boolean;
}) => {
  const t = useTranslations("@vitnode/blog.admin.article.editor.seo");

  return (
    <li className="flex gap-3 py-3">
      {ok ? (
        <CircleCheckIcon
          aria-label={t("done")}
          className="text-success mt-0.5 size-4 shrink-0"
        />
      ) : (
        <CircleAlertIcon
          aria-label={t("needs_work")}
          className="text-warn mt-0.5 size-4 shrink-0"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {label ? <span className="text-sm font-medium">{label}</span> : null}
        {children}
      </div>
    </li>
  );
};

const Detail = ({ children }: { children: React.ReactNode }) => (
  <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
    {children}
  </p>
);

export const SeoAudit = ({
  actionsFor,
  checks,
  cover,
  excerptField,
  languageName,
  locale,
  onEditAlt,
  sourceName,
  values,
}: {
  actionsFor: (check: ArticleCheck) => CheckAction[];
  checks: ArticleCheck[];
  cover: ContentFileFieldValue | undefined;
  excerptField: React.ReactNode;
  languageName: (code: string) => string;
  locale: string;
  onEditAlt: () => void;
  sourceName: string;
  values: ArticleValues;
}) => {
  const t = useTranslations("@vitnode/blog.admin.article.editor.seo");
  const tPublish = useTranslations(
    "@vitnode/blog.admin.article.editor.publish",
  );
  const detailOf = useCheckDetail({ languageName, sourceName });
  const checkOf = (id: ArticleCheck["id"]) =>
    checks.find(check => check.id === id);
  const title = getLangValue(values.title, locale);
  const slug = getLangValue(values.friendlyUrl, locale).trim();
  const coverUrl = coverUrlOf(values.coverImage, cover);

  const titleCheck = checkOf("title");
  const excerptCheck = checkOf("excerpt");
  const coverCheck = checkOf("cover");
  const altCheck = checkOf("alt");
  const translationChecks = checks.filter(
    check => check.id === "translations" || check.id === "outdated",
  );
  const rows = [
    { label: t("rows.title"), ok: titleCheck?.ok ?? true },
    { label: t("rows.excerpt"), ok: excerptCheck?.ok ?? true },
    { label: t("rows.url"), ok: slug !== "" },
    { label: t("rows.cover"), ok: coverCheck?.ok ?? true },
    { label: t("rows.alt"), ok: altCheck?.ok ?? true },
    ...translationChecks.map(check => ({
      label: tPublish(`checks.${check.id}`),
      ok: check.ok,
    })),
  ];
  const left = rows.filter(row => !row.ok);
  const missing = (check: ArticleCheck | undefined) =>
    check && !check.ok ? <Detail>{detailOf(check)}</Detail> : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold" id="article-ready">
            {tPublish("title")}
          </h3>
          <span className="text-muted-foreground text-xs tabular-nums">
            {rows.length - left.length}/{rows.length}
          </span>
        </div>
        <Segments done={rows.length - left.length} total={rows.length} />
        {left.length > 0 ? (
          <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
            {t("left", { items: left.map(row => row.label).join(", ") })}
          </p>
        ) : null}
      </div>

      <ul className="flex flex-col divide-y">
        <AuditRow label={t("rows.title")} ok={titleCheck?.ok ?? true}>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {title}
          </p>
          <div className="flex items-center gap-3">
            <LengthMeter max={RECOMMENDED_LENGTH.title} value={title} />
            <CharacterCount field="title" value={title} />
          </div>
          {missing(titleCheck)}
        </AuditRow>

        <AuditRow ok={excerptCheck?.ok ?? true}>
          <div className="flex flex-col gap-2">{excerptField}</div>
          {missing(excerptCheck)}
        </AuditRow>

        <AuditRow label={t("rows.url")} ok={slug !== ""}>
          <Detail>{slug ? `/blog/${slug}` : t("url_missing")}</Detail>
        </AuditRow>

        <AuditRow label={t("rows.cover")} ok={coverCheck?.ok ?? true}>
          {coverUrl ? (
            <div className="flex items-center gap-3">
              <img
                alt=""
                className="aspect-[1.91/1] w-20 rounded-md object-cover"
                decoding="async"
                loading="lazy"
                src={coverUrl}
              />
              <Detail>{t("cover_cropped")}</Detail>
            </div>
          ) : null}
          {missing(coverCheck)}
        </AuditRow>

        <AuditRow label={t("rows.alt")} ok={altCheck?.ok ?? true}>
          {missing(altCheck)}
          <CheckActions
            actions={[
              { label: t("alt_edit"), run: onEditAlt },
              ...(altCheck && !altCheck.ok ? actionsFor(altCheck) : []),
            ]}
          />
        </AuditRow>

        {translationChecks.map(check => (
          <AuditRow
            key={check.id}
            label={tPublish(`checks.${check.id}`)}
            ok={check.ok}
          >
            {missing(check)}
            {check.ok ? null : <CheckActions actions={actionsFor(check)} />}
          </AuditRow>
        ))}
      </ul>
    </div>
  );
};
