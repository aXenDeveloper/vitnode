import { cn } from "cn";
import {
  ArrowRightIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { AdminLink } from "@/views/admin/layouts/admin-link";
import { ADMIN_PLUGINS_HREF } from "@/views/admin/layouts/sidebar/nav/nav-model";
import {
  type AdminUpdateSummary,
  useAdminUpdateSummary,
} from "@/views/admin/views/core/system/plugins/update-summary-query";

import type { UpdateStatus } from "./update-status";

import { WidgetContentSkeleton } from "../../grid/widget-skeleton";
import {
  compactVersion,
  isKnownUpdateStatus,
  updateStatusOf,
} from "./update-status";

const STATUS_TONE: Record<UpdateStatus, string> = {
  disabled: "text-muted-foreground",
  not_checked: "text-muted-foreground",
  running: "text-muted-foreground",
  security: "text-destructive",
  unavailable: "text-muted-foreground",
  unconfirmed: "text-muted-foreground",
  up_to_date: "text-success",
  updates: "text-primary",
};

const STATUS_TEXT_TONE: Partial<Record<UpdateStatus, string>> = {
  security: STATUS_TONE.security,
  up_to_date: STATUS_TONE.up_to_date,
  updates: STATUS_TONE.updates,
};

const Row = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <div className="flex items-center justify-between gap-4 py-2">
    <dt className="text-muted-foreground shrink-0 text-sm">{label}</dt>
    <dd className="flex min-w-0 items-center justify-end gap-1.5 text-end text-sm font-medium tabular-nums">
      {children}
    </dd>
  </div>
);

const Unknown = () => {
  const t = useTranslations("admin.dashboard.widgets.system-updates");

  return (
    <>
      <span aria-hidden>-</span>
      <span className="sr-only">{t("unknown")}</span>
    </>
  );
};

const Warning = ({ children }: { children: React.ReactNode }) => (
  <span className="text-warn inline-flex items-center gap-1">
    <TriangleAlertIcon aria-hidden className="size-4 shrink-0" />
    {children}
  </span>
);

const LastChecked = ({ summary }: { summary: AdminUpdateSummary }) => {
  const t = useTranslations(
    "admin.dashboard.widgets.system-updates.last_checked",
  );
  const date = (value: string) => () => <DateFormat date={value} />;

  if (!summary.enabled) return <Unknown />;
  if (summary.running) return t("running");
  if (summary.failedComponents > 0 && summary.lastAttemptAt !== null) {
    return (
      <Warning>
        {t.rich("failed", { date: date(summary.lastAttemptAt) })}
      </Warning>
    );
  }
  if (summary.stale) return <Warning>{t("stale")}</Warning>;

  const checkedAt = summary.oldestSuccessAt ?? summary.lastAttemptAt;

  return checkedAt === null ? t("never") : <DateFormat date={checkedAt} />;
};

export const SystemUpdatesWidget = () => {
  const t = useTranslations("admin.dashboard.widgets.system-updates");
  const { data, isError } = useAdminUpdateSummary();

  if (isError) {
    return (
      <div className="flex flex-col gap-3">
        <p className="flex items-start gap-2 text-sm leading-relaxed">
          <TriangleAlertIcon
            aria-hidden
            className="text-warn mt-0.5 size-4 shrink-0"
          />
          <span className="text-pretty">{t("load_error")}</span>
        </p>
        <ViewPlugins />
      </div>
    );
  }
  if (data === undefined) return <WidgetContentSkeleton />;

  const status = updateStatusOf(data);
  const known = isKnownUpdateStatus(status);

  return (
    <div className="flex h-full flex-col gap-2">
      <dl className="divide-border flex flex-col divide-y">
        <Row label={t("rows.status")}>
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full bg-current",
              STATUS_TONE[status],
            )}
          />
          <span aria-live="polite" className={STATUS_TEXT_TONE[status]}>
            {t(`status.${status}`, { count: data.unconfirmedComponents })}
          </span>
        </Row>
        <Row label={t("rows.core")}>
          {data.core.version === null ? (
            <Unknown />
          ) : (
            <span className="truncate font-mono">{data.core.version}</span>
          )}
          {known && data.core.latestVersion !== null ? (
            <span className="text-primary shrink-0 font-mono">
              <span aria-hidden>
                → {compactVersion(data.core.version, data.core.latestVersion)}
              </span>
              <span className="sr-only">
                {t("core_update", { version: data.core.latestVersion })}
              </span>
            </span>
          ) : null}
        </Row>
        <Row label={t("rows.plugin_updates")}>
          {known ? data.pluginUpdatesAvailable : <Unknown />}
        </Row>
        <Row label={t("rows.security")}>
          {!known ? (
            <Unknown />
          ) : data.affectedComponents > 0 ? (
            <span className="text-destructive inline-flex items-center gap-1">
              <ShieldAlertIcon aria-hidden className="size-4 shrink-0" />
              {t("security_affected", { count: data.affectedComponents })}
            </span>
          ) : (
            t("security_none")
          )}
        </Row>
        <Row label={t("rows.last_checked")}>
          <LastChecked summary={data} />
        </Row>
      </dl>
      <div className="mt-auto">
        <ViewPlugins />
      </div>
    </div>
  );
};

const ViewPlugins = () => {
  const t = useTranslations("admin.dashboard.widgets.system-updates");

  return (
    <AdminLink
      className="text-primary inline-flex items-center gap-1 self-start text-sm font-medium underline-offset-4 hover:underline"
      href={ADMIN_PLUGINS_HREF}
    >
      {t("view_plugins")}
      <ArrowRightIcon aria-hidden className="size-4" />
    </AdminLink>
  );
};
