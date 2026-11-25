import type { LegalVersionMeta } from "@vitnode/api/lib/legal/contract";

import { Link } from "@tanstack/react-router";
import { useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";

import { legalBasePath, useLegalDate } from "./legal-format";

const STATUS_VARIANT = {
  current: "success",
  past: "secondary",
  upcoming: "warning",
} as const;

/** Every announced version of a document, newest first, with stable links. */
export const LegalHistory = ({
  activeVersion,
  history,
}: {
  activeVersion?: number;
  history: LegalVersionMeta[];
}) => {
  const t = useTranslations("core.legal");
  const formatDate = useLegalDate();

  return (
    <section
      aria-labelledby="legal-history-title"
      className="flex flex-col gap-3 print:hidden"
      id="history"
    >
      <div className="flex flex-col gap-1">
        <h2
          className="text-lg font-semibold text-balance"
          id="legal-history-title"
        >
          {t("history.title")}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("history.desc")}
        </p>
      </div>

      <ol className="divide-border flex flex-col divide-y rounded-xl border">
        {history.map(item => {
          const base = legalBasePath(item.documentType);
          const isActive = item.version === activeVersion;

          return (
            <li
              aria-current={isActive ? "page" : undefined}
              className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              key={item.id}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {t("version", { version: item.version })}
                  </span>
                  <Badge variant={STATUS_VARIANT[item.status]}>
                    {t(`status.${item.status}`)}
                  </Badge>
                  {item.requiresAcceptance ? (
                    <Badge variant="outline">{t("requires_acceptance")}</Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  <time dateTime={item.effectiveAt}>
                    {t("meta.effective", {
                      date: formatDate(item.effectiveAt),
                    })}
                  </time>
                  {" · "}
                  <time dateTime={item.announcedAt}>
                    {t("meta.announced", {
                      date: formatDate(item.announcedAt),
                    })}
                  </time>
                </p>
                {item.summary ? (
                  <p className="line-clamp-2 text-sm leading-relaxed text-pretty">
                    {item.summary}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-4 text-sm">
                <Link
                  className="text-primary underline-offset-4 hover:underline"
                  to={`${base}/versions/${item.version}`}
                >
                  {t("actions.read")}
                  <span className="sr-only">
                    {` ${t("version", { version: item.version })}`}
                  </span>
                </Link>
                {item.version > 1 ? (
                  <Link
                    className="text-primary underline-offset-4 hover:underline"
                    to={`${base}/versions/${item.version}/changes`}
                  >
                    {t("actions.changes")}
                    <span className="sr-only">
                      {` ${t("version", { version: item.version })}`}
                    </span>
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
