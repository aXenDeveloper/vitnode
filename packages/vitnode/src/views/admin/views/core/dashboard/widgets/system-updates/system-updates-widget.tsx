import { cn } from "cn";
import {
  ArrowRightIcon,
  ArrowUpCircleIcon,
  CircleCheckIcon,
  CircleHelpIcon,
  CircleOffIcon,
  ClockIcon,
  LoaderCircleIcon,
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

const STATUS_ICON: Record<UpdateStatus, React.ElementType> = {
  disabled: CircleOffIcon,
  no_info: CircleHelpIcon,
  not_checked: ClockIcon,
  running: LoaderCircleIcon,
  security: ShieldAlertIcon,
  unavailable: CircleHelpIcon,
  unconfirmed: CircleCheckIcon,
  up_to_date: CircleCheckIcon,
  updates: ArrowUpCircleIcon,
};

const STATUS_TONE: Record<UpdateStatus, string> = {
  disabled: "text-muted-foreground",
  no_info: "text-muted-foreground",
  not_checked: "text-muted-foreground",
  running: "text-muted-foreground",
  security: "text-destructive",
  unavailable: "text-muted-foreground",
  unconfirmed: "text-success",
  up_to_date: "text-success",
  updates: "text-primary",
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
    <span className="text-muted-foreground font-normal">{t("unknown")}</span>
  );
};

const Warning = ({ children }: { children: React.ReactNode }) => (
  <span className="text-warn inline-flex items-center gap-1">
    <TriangleAlertIcon aria-hidden className="size-4 shrink-0" />
    <span>{children}</span>
  </span>
);

const Verdict = ({
  status,
  summary,
}: {
  status: UpdateStatus;
  summary: AdminUpdateSummary;
}) => {
  const t = useTranslations(
    "admin.dashboard.widgets.system-updates.verdict",
  );
  const Icon = STATUS_ICON[status];
  const unconfirmed = summary.unconfirmedComponents;
  const count: Record<UpdateStatus, number> = {
    disabled: 0,
    no_info: summary.totalComponents,
    not_checked: 0,
    running: 0,
    security: summary.affectedComponents,
    unavailable: summary.totalComponents,
    unconfirmed,
    up_to_date: summary.totalComponents,
    updates: summary.updatesAvailable,
  };

  return (
    <div className="flex items-start gap-3">
      <Icon
        aria-hidden
        className={cn(
          "mt-0.5 size-5 shrink-0",
          STATUS_TONE[status],
          status === "running" && "motion-safe:animate-spin",
        )}
      />
      <div aria-live="polite" className="flex min-w-0 flex-col gap-1">
        <p className="font-medium text-balance">{t(`${status}.title`)}</p>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t(`${status}.desc`, {
            count: count[status],
            total: summary.totalComponents,
            verified: summary.totalComponents - unconfirmed,
          })}
        </p>
      </div>
    </div>
  );
};

const Checked = ({
  summary,
}: {
  summary: AdminUpdateSummary;
}): React.ReactNode => {
  const t = useTranslations("admin.dashboard.widgets.system-updates.checked");
  const date = (value: string) => () => <DateFormat date={value} />;
  const checkedAt = summary.oldestSuccessAt ?? summary.lastAttemptAt;

  if (!summary.enabled) return null;
  if (summary.running) return t("running");
  if (summary.failedComponents > 0 && summary.lastAttemptAt !== null) {
    return (
      <Warning>
        {t.rich("failed", { date: date(summary.lastAttemptAt) })}
      </Warning>
    );
  }
  if (checkedAt === null) return t("never");
  if (summary.stale) {
    return <Warning>{t.rich("stale", { date: date(checkedAt) })}</Warning>;
  }

  return t.rich("at", { date: date(checkedAt) });
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
  const verified = known
    ? data.totalComponents - data.unconfirmedComponents
    : 0;

  return (
    <div className="flex h-full flex-col gap-4">
      <Verdict status={status} summary={data} />
      <dl className="divide-border flex flex-col divide-y border-t">
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
          {verified === 0 ? (
            <Unknown />
          ) : data.pluginUpdatesAvailable > 0 ? (
            <span className="text-primary">
              {t("plugin_updates.available", {
                count: data.pluginUpdatesAvailable,
              })}
            </span>
          ) : (
            t("plugin_updates.none")
          )}
        </Row>
        <Row label={t("rows.security")}>
          {verified === 0 ? (
            <Unknown />
          ) : data.affectedComponents > 0 ? (
            <span className="text-destructive inline-flex items-center gap-1">
              <ShieldAlertIcon aria-hidden className="size-4 shrink-0" />
              {t("security.affected", { count: data.affectedComponents })}
            </span>
          ) : (
            t("security.none")
          )}
        </Row>
        {known && data.unconfirmedComponents > 0 ? (
          <Row label={t("rows.no_info")}>
            {t("no_info_count", {
              count: data.unconfirmedComponents,
              total: data.totalComponents,
            })}
          </Row>
        ) : null}
      </dl>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <ViewPlugins />
        <span className="text-muted-foreground text-sm">
          <Checked summary={data} />
        </span>
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
