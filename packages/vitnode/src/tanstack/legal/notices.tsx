import type { LegalMemberState } from "@vitnode/api/lib/legal/contract";

import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ScrollTextIcon, XIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { legalBasePath, useLegalDate } from "@/views/legal/legal-format";
import { dismissLegalNotice } from "@/views/legal/legal-query";

import { invalidateSession, useSessionQuery } from "../auth/session-query";
import { RouteMessages } from "../i18n/route-messages";

type Notice = LegalMemberState["notices"][number];

const NoticeAlert = ({ notice }: { notice: Notice }) => {
  const t = useTranslations("core.legal.notice");
  const formatDate = useLegalDate();
  const queryClient = useQueryClient();
  const [isPending, setPending] = React.useState(false);
  const base = legalBasePath(notice.documentType);
  const text = notice.upcoming
    ? t(`${notice.documentType}_upcoming`, {
        date: formatDate(notice.effectiveAt),
        version: notice.version,
      })
    : t(notice.documentType, { version: notice.version });

  return (
    <Alert icon={<ScrollTextIcon aria-hidden="true" />} variant="info">
      <AlertDescription>
        <p className="text-pretty">
          {text}
          {notice.upcoming && notice.requiresAcceptance
            ? ` ${t("acceptance_upcoming")}`
            : null}
        </p>
        <Link
          className="text-primary underline-offset-4 hover:underline"
          to={
            notice.previousVersion === null
              ? `${base}/versions/${notice.version}`
              : `${base}/versions/${notice.version}/changes`
          }
        >
          {t("changes")}
        </Link>
      </AlertDescription>
      <AlertAction>
        <Button
          aria-label={t("dismiss")}
          isLoading={isPending}
          onClick={async () => {
            setPending(true);
            try {
              const ok = await dismissLegalNotice(notice.versionId);
              if (!ok) {
                toast.error(t("dismiss_error"));

                return;
              }
              await invalidateSession(queryClient);
            } finally {
              setPending(false);
            }
          }}
          size="icon"
          variant="ghost"
        >
          <XIcon aria-hidden="true" />
        </Button>
      </AlertAction>
    </Alert>
  );
};

const NoticesList = ({ notices }: { notices: Notice[] }) => {
  const t = useTranslations("core.legal.notice");

  return (
    <section
      aria-label={t("region")}
      className="container mx-auto flex flex-col gap-2 px-4 pt-4 print:hidden"
    >
      {notices.map(notice => (
        <NoticeAlert key={notice.versionId} notice={notice} />
      ))}
    </section>
  );
};

/**
 * Informational notices about new Terms of Service and Privacy Policy
 * versions, for the signed-in member, until they dismiss each one. Dismissing
 * records only the dismissal. Rendered by `MainHeader`.
 */
export const LegalNotices = () => {
  const { data } = useSessionQuery();
  const legal = data?.user?.legal;
  if (!legal || legal.pendingTerms || legal.notices.length === 0) return null;

  return (
    <React.Suspense fallback={null}>
      <RouteMessages namespaces={["core.legal"]}>
        <NoticesList notices={legal.notices} />
      </RouteMessages>
    </React.Suspense>
  );
};
