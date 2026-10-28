import { Link } from "@tanstack/react-router";
import { ShieldAlertIcon } from "lucide-react";
import { useFormatter, useTranslations } from "use-intl";

import { useSessionQuery } from "../auth/session-query";
import { RouteMessages } from "../i18n/route-messages";
import { REPORT_NAMESPACES } from "./report-button";

export const ACCOUNT_STATUS_PATH = "/account-status";

const Notice = ({ endsAt }: { endsAt: Date | null | string }) => {
  const t = useTranslations("core.moderation.account_status.notice");
  const format = useFormatter();

  return (
    <div
      className="bg-destructive/10 text-foreground border-destructive/20 border-b"
      role="status"
    >
      <div className="container mx-auto flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm leading-relaxed">
        <ShieldAlertIcon
          aria-hidden="true"
          className="text-destructive size-4 shrink-0"
        />
        <p className="text-pretty">
          {endsAt
            ? t("until", {
                endsAt: format.dateTime(new Date(endsAt), {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })
            : t("indefinite")}
        </p>
        <Link
          className="text-foreground font-medium underline underline-offset-4"
          to={ACCOUNT_STATUS_PATH}
        >
          {t("details")}
        </Link>
      </div>
    </div>
  );
};

/**
 * A strip under the header while the session's account is suspended. The API
 * treats such a session as a guest everywhere; this tells the member why and
 * links to their account status. Renders nothing otherwise.
 */
export const SuspensionNotice = () => {
  const { data } = useSessionQuery();
  const suspension = data?.suspension;
  if (!suspension) return null;

  return (
    <RouteMessages namespaces={REPORT_NAMESPACES}>
      <Notice endsAt={suspension.endsAt} />
    </RouteMessages>
  );
};
