import type {
  LegalVersionDocument,
  LegalVersionMeta,
} from "@vitnode/api/lib/legal/contract";

import { Link } from "@tanstack/react-router";
import {
  CalendarClockIcon,
  DownloadIcon,
  GitCompareIcon,
  HistoryIcon,
  PrinterIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import { RichTextContent } from "@/components/rich-text/rich-text-content";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";

import { legalBasePath, useLegalDate } from "./legal-format";
import { legalDownloadHref } from "./legal-query";

/**
 * One announced version, readable and printable: title, version, dates, the
 * change summary, the full text and links to its history and comparison.
 * Notes when a newer version is in effect or an update is scheduled.
 */
export const LegalDocumentView = ({
  current,
  document,
  preview = false,
  upcoming,
}: {
  /** The version in effect, when `document` is another one. */
  current: null | Pick<LegalVersionMeta, "version">;
  document: LegalVersionDocument;
  /** An unpublished draft: the same rendering without links or actions. */
  preview?: boolean;
  upcoming: LegalVersionMeta | null;
}) => {
  const t = useTranslations("core.legal");
  const formatDate = useLegalDate();
  const base = legalBasePath(document.documentType);
  const isArchived =
    document.status !== "current" &&
    current &&
    current.version !== document.version;

  return (
    <article className="flex flex-col gap-6" lang={document.locale}>
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {t("version", { version: document.version })}
          </Badge>
          <Badge
            variant={
              document.status === "current"
                ? "success"
                : document.status === "upcoming"
                  ? "warning"
                  : "secondary"
            }
          >
            {t(`status.${document.status}`)}
          </Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {document.title}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          <time dateTime={document.effectiveAt}>
            {document.status === "upcoming"
              ? t("meta.effective_from", {
                  date: formatDate(document.effectiveAt),
                })
              : t("meta.effective_since", {
                  date: formatDate(document.effectiveAt),
                })}
          </time>
          {" · "}
          <time dateTime={document.announcedAt}>
            {t("meta.announced", { date: formatDate(document.announcedAt) })}
          </time>
        </p>

        {preview ? null : (
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              onClick={() => {
                window.print();
              }}
              variant="outline"
            >
              <PrinterIcon aria-hidden="true" />
              {t("actions.print")}
            </Button>
            <a
              className={buttonVariants({ variant: "outline" })}
              download
              href={legalDownloadHref({
                documentType: document.documentType,
                locale: document.locale,
                version: document.version,
              })}
            >
              <DownloadIcon aria-hidden="true" />
              {t("actions.download")}
            </a>
            {document.previousVersion === null ? null : (
              <Link
                className={buttonVariants({ variant: "outline" })}
                to={`${base}/versions/${document.version}/changes`}
              >
                <GitCompareIcon aria-hidden="true" />
                {t("actions.changes")}
              </Link>
            )}
            <a className={buttonVariants({ variant: "ghost" })} href="#history">
              <HistoryIcon aria-hidden="true" />
              {t("actions.history")}
            </a>
          </div>
        )}
      </header>

      {isArchived && !preview ? (
        <Alert className="print:hidden" variant="info">
          <AlertTitle>{t("archived.title")}</AlertTitle>
          <AlertDescription>
            <p>{t("archived.desc", { version: current.version })}</p>
            <Link
              className="text-primary underline-offset-4 hover:underline"
              to={base}
            >
              {t("actions.current")}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {upcoming && upcoming.version !== document.version && !preview ? (
        <Alert
          className="print:hidden"
          icon={<CalendarClockIcon aria-hidden="true" />}
          variant="warning"
        >
          <AlertTitle>{t("upcoming.title")}</AlertTitle>
          <AlertDescription>
            <p>
              {t("upcoming.desc", {
                date: formatDate(upcoming.effectiveAt),
                version: upcoming.version,
              })}
            </p>
            <Link
              className="text-primary underline-offset-4 hover:underline"
              to={`${base}/versions/${upcoming.version}/changes`}
            >
              {t("actions.changes")}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {document.summary && document.previousVersion !== null ? (
        <section
          aria-labelledby="legal-summary-title"
          className="bg-muted/50 flex flex-col gap-2 rounded-xl border p-4"
        >
          <h2 className="font-semibold" id="legal-summary-title">
            {t("summary_title")}
          </h2>
          <p className="text-sm leading-relaxed text-pretty whitespace-pre-line">
            {document.summary}
          </p>
        </section>
      ) : null}

      <RichTextContent className="leading-relaxed" content={document.body} />
    </article>
  );
};
