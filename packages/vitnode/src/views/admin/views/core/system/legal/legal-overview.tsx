import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  FileTextIcon,
  MailWarningIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLegalDate } from "@/views/legal/legal-format";

import type { AdminLegalOverview } from "./legal-admin-query";

const ICONS = { privacy: ShieldCheckIcon, terms: FileTextIcon } as const;

/** One card per document type: in effect, upcoming, draft and history size. */
export const LegalOverviewContent = ({
  data,
}: {
  data: AdminLegalOverview;
}) => {
  const t = useTranslations("admin.system.legal");
  const formatDate = useLegalDate();

  return (
    <div className="flex flex-col gap-6">
      {data.emailConfigured ? null : (
        <Alert icon={<MailWarningIcon aria-hidden="true" />} variant="warning">
          <AlertTitle>{t("email_missing.title")}</AlertTitle>
          <AlertDescription>{t("email_missing.desc")}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data.documents.map(document => {
          const Icon = ICONS[document.documentType];

          return (
            <Card key={document.documentType}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon aria-hidden="true" className="size-5" />
                  <h2>{t(`types.${document.documentType}`)}</h2>
                </CardTitle>
                <CardDescription className="text-pretty">
                  {t(`type_desc.${document.documentType}`)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">{t("current")}</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    {document.current ? (
                      <>
                        <span className="font-medium">
                          {t("version", { version: document.current.version })}
                        </span>
                        <time
                          className="text-muted-foreground"
                          dateTime={document.current.effectiveAt}
                        >
                          {formatDate(document.current.effectiveAt)}
                        </time>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        {t("not_published")}
                      </span>
                    )}
                  </dd>

                  <dt className="text-muted-foreground">{t("upcoming")}</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    {document.upcoming ? (
                      <>
                        <Badge variant="warning">
                          {t("version", { version: document.upcoming.version })}
                        </Badge>
                        <time dateTime={document.upcoming.effectiveAt}>
                          {formatDate(document.upcoming.effectiveAt)}
                        </time>
                        {document.upcoming.requiresAcceptance ? (
                          <Badge variant="outline">
                            {t("requires_acceptance")}
                          </Badge>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">{t("none")}</span>
                    )}
                  </dd>

                  <dt className="text-muted-foreground">{t("draft")}</dt>
                  <dd>
                    {document.draft ? (
                      <time dateTime={document.draft.updatedAt}>
                        {t("draft_updated", {
                          date: formatDate(document.draft.updatedAt),
                        })}
                      </time>
                    ) : (
                      <span className="text-muted-foreground">{t("none")}</span>
                    )}
                  </dd>
                </dl>
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-sm">
                  {t("versions_count", { count: document.versionsCount })}
                </span>
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  to={`/admin/core/system/legal/${document.documentType}`}
                >
                  {t("open")}
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
