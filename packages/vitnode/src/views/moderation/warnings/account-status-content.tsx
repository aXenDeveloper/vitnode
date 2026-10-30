import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon, LogInIcon, ShieldAlertIcon } from "lucide-react";
import React from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { Skeleton } from "@/components/ui/skeleton";

import type { AccountStatus } from "./warnings-api";

import { resolveReasonText } from "../report-reasons-query";
import { WarningStatusBadge } from "./warning-format";
import { accountStatusQueryOptions } from "./warnings-api";

const SuspensionAlert = ({
  suspension,
}: {
  suspension: NonNullable<AccountStatus["suspension"]>;
}) => {
  const t = useTranslations("core.moderation.account_status");
  const format = useFormatter();

  return (
    <Alert icon={<ShieldAlertIcon />} variant="destructive">
      <AlertTitle className="text-balance">{t("suspended_title")}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2 text-pretty">
        <p>
          {suspension.endsAt
            ? t("suspended_until", {
                endsAt: format.dateTime(new Date(suspension.endsAt), {
                  dateStyle: "full",
                  timeStyle: "short",
                }),
              })
            : t("suspended_indefinite")}
        </p>
        <p>{t("suspended_restrictions")}</p>
        <p>{t("contact")}</p>
      </AlertDescription>
    </Alert>
  );
};

const OwnWarning = ({
  warning,
}: {
  warning: AccountStatus["warnings"][number];
}) => {
  const t = useTranslations("core.moderation.account_status");
  const tWarn = useTranslations("core.moderation.warn");
  const locale = useLocale();
  const titleId = React.useId();

  return (
    <article
      aria-labelledby={titleId}
      className="bg-card ring-foreground/5 flex flex-col gap-3 rounded-xl p-4 shadow-xs ring-1 dark:shadow-none"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3
            className="text-foreground font-semibold text-balance"
            id={titleId}
          >
            {warning.reason
              ? resolveReasonText(warning.reason, locale)
              : tWarn("custom_reason")}
          </h3>
          <p className="text-muted-foreground text-sm">
            <DateFormat date={warning.issuedAt} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {tWarn("points", { count: warning.points })}
          </Badge>
          <WarningStatusBadge status={warning.status} />
        </div>
      </header>
      <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
        {warning.message}
      </p>
      <dl className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex gap-1.5">
          <dt>{t("expires")}</dt>
          <dd className="text-foreground">
            {warning.expiresAt ? (
              <DateFormat date={warning.expiresAt} showFullDate />
            ) : (
              t("never")
            )}
          </dd>
        </div>
        {warning.content ? (
          <div className="flex gap-1.5">
            <dt>{t("content")}</dt>
            <dd className="text-foreground">
              {warning.content.url ? (
                <a
                  className="text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
                  href={warning.content.url}
                >
                  {warning.content.title ?? t("untitled")}
                  <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
                </a>
              ) : (
                (warning.content.title ?? t("untitled"))
              )}
            </dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
};

const Pending = ({ label }: { label: string }) => (
  <div aria-busy="true" className="flex flex-col gap-4">
    <span className="sr-only" role="status">
      {label}
    </span>
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-32 w-full" />
  </div>
);

/**
 * The member's own standing: an active suspension, if any, active points and
 * warning history. Works for a suspended account too. Never shows staff notes
 * or who issued a warning.
 */
export const AccountStatusContent = () => {
  const t = useTranslations("core.moderation.account_status");
  const { data, isPending } = useQuery(accountStatusQueryOptions());

  return (
    <div className="container mx-auto flex max-w-3xl flex-col gap-6 p-4">
      <PageTitle desc={t("desc")} h1={t("title")} />
      {isPending ? (
        <Pending label={t("loading")} />
      ) : !data ? (
        <div className="bg-card ring-foreground/5 flex flex-col items-start gap-3 rounded-xl p-4 ring-1">
          <p className="text-sm leading-relaxed">{t("signed_out")}</p>
          <Link className={buttonVariants()} to="/login">
            <LogInIcon aria-hidden="true" />
            {t("sign_in")}
          </Link>
        </div>
      ) : (
        <>
          {data.suspension ? (
            <SuspensionAlert suspension={data.suspension} />
          ) : (
            <Alert variant="success">
              <AlertTitle>{t("good_title")}</AlertTitle>
              <AlertDescription className="text-pretty">
                {t("good_desc")}
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-card ring-foreground/5 flex items-center justify-between gap-4 rounded-xl p-4 ring-1">
            <div className="flex flex-col gap-1">
              <h2 className="text-foreground font-semibold">
                {t("points_title")}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                {t("points_desc")}
              </p>
            </div>
            <p className="text-foreground text-3xl font-semibold tabular-nums">
              {data.activePoints}
            </p>
          </div>

          <section
            aria-labelledby="own-warnings"
            className="flex flex-col gap-3"
          >
            <h2
              className="text-foreground text-lg font-semibold"
              id="own-warnings"
            >
              {t("warnings_title")}
            </h2>
            {data.warnings.length === 0 ? (
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("no_warnings")}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.warnings.map(warning => (
                  <li key={warning.id}>
                    <OwnWarning warning={warning} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.sanctions.length > 0 ? (
            <section
              aria-labelledby="own-sanctions"
              className="flex flex-col gap-3"
            >
              <h2
                className="text-foreground text-lg font-semibold"
                id="own-sanctions"
              >
                {t("sanctions_title")}
              </h2>
              <ul className="flex flex-col gap-2">
                {data.sanctions.map(sanction => (
                  <li
                    className="bg-card ring-foreground/5 flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 text-sm ring-1"
                    key={sanction.id}
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="text-foreground font-medium">
                        {sanction.endsAt
                          ? t("sanction_temporary")
                          : t("sanction_indefinite")}
                      </span>
                      <span className="text-muted-foreground">
                        <DateFormat date={sanction.startsAt} showFullDate />
                        {sanction.endsAt ? (
                          <>
                            {" – "}
                            <DateFormat date={sanction.endsAt} showFullDate />
                          </>
                        ) : null}
                      </span>
                    </span>
                    <Badge
                      variant={
                        sanction.active
                          ? "destructive"
                          : sanction.revoked
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {sanction.active
                        ? t("sanction_active")
                        : sanction.revoked
                          ? t("sanction_lifted")
                          : t("sanction_ended")}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
};
