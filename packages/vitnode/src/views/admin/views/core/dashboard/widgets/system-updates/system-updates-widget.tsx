import { cn } from "cn";
import {
  ArrowRightIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleOffIcon,
  ClockAlertIcon,
  LoaderCircleIcon,
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

import { WidgetContentSkeleton } from "../../grid/widget-skeleton";

const TONE = {
  destructive: "text-destructive",
  muted: "text-muted-foreground",
  success: "text-success",
  warn: "text-warn",
} as const;

type Tone = keyof typeof TONE;

const StatusLine = ({
  children,
  icon: Icon,
  spin,
  tone,
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ "aria-hidden"?: boolean; className?: string }>;
  spin?: boolean;
  tone: Tone;
}) => (
  <p className="flex items-start gap-2 text-sm leading-relaxed">
    <Icon
      aria-hidden
      className={cn(
        "mt-0.5 size-4 shrink-0",
        TONE[tone],
        spin && "animate-spin",
      )}
    />
    <span className="text-pretty">{children}</span>
  </p>
);

/** How fresh the numbers are - the first thing to read before trusting them. */
const Freshness = ({ summary }: { summary: AdminUpdateSummary }) => {
  const t = useTranslations("admin.dashboard.widgets.system-updates.freshness");
  const date = (value: string) => () => <DateFormat date={value} />;

  if (!summary.enabled) {
    return (
      <StatusLine icon={CircleOffIcon} tone="muted">
        {t("disabled")}
      </StatusLine>
    );
  }
  if (summary.running) {
    return (
      <StatusLine icon={LoaderCircleIcon} spin tone="muted">
        {t("running")}
      </StatusLine>
    );
  }
  if (summary.checkedComponents === 0) {
    return (
      <StatusLine icon={CircleDashedIcon} tone="muted">
        {summary.notCheckedComponents > 0 ? t("not_checked") : t("unavailable")}
      </StatusLine>
    );
  }
  if (summary.failedComponents > 0) {
    return (
      <StatusLine icon={TriangleAlertIcon} tone="warn">
        {summary.lastAttemptAt === null
          ? t("failed", { count: summary.failedComponents })
          : t.rich("failed_at", {
              count: summary.failedComponents,
              date: date(summary.lastAttemptAt),
            })}
      </StatusLine>
    );
  }
  if (summary.stale) {
    return (
      <StatusLine icon={ClockAlertIcon} tone="warn">
        {t("stale")}
      </StatusLine>
    );
  }
  if (summary.oldestSuccessAt === null) {
    return (
      <StatusLine icon={CircleDashedIcon} tone="muted">
        {t("incomplete", { count: summary.notCheckedComponents })}
      </StatusLine>
    );
  }

  return (
    <StatusLine icon={CircleCheckIcon} tone="success">
      {t.rich("checked", { date: date(summary.oldestSuccessAt) })}
    </StatusLine>
  );
};

const Stat = ({
  children,
  label,
  tone,
}: {
  children: React.ReactNode;
  label: string;
  tone?: Tone;
}) => (
  <div className="bg-muted/50 flex min-w-0 flex-col gap-1 rounded-lg p-3">
    <dt className="text-muted-foreground text-xs leading-relaxed">{label}</dt>
    <dd
      className={cn(
        "flex min-w-0 flex-col text-lg font-semibold tabular-nums",
        tone && TONE[tone],
      )}
    >
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

/**
 * Core's version and what the stored update checks know about core and
 * plugins. Reads the summary every AdminCP surface shares; it never starts a
 * check - that stays a button on the Plugins page.
 */
export const SystemUpdatesWidget = () => {
  const t = useTranslations("admin.dashboard.widgets.system-updates");
  const { data, isError } = useAdminUpdateSummary();

  if (isError) {
    return (
      <div className="flex flex-col gap-3">
        <StatusLine icon={TriangleAlertIcon} tone="warn">
          {t("load_error")}
        </StatusLine>
        <ViewPlugins />
      </div>
    );
  }
  if (data === undefined) return <WidgetContentSkeleton />;

  // Before anything was checked a count of 0 would read as "nothing to do".
  const known = data.enabled && data.checkedComponents > 0;
  const upToDate =
    known &&
    data.updatesAvailable === 0 &&
    data.affectedComponents === 0 &&
    data.unconfirmedComponents === 0 &&
    data.failedComponents === 0 &&
    !data.stale;

  return (
    <div className="flex h-full flex-col gap-4">
      <div aria-live="polite">
        <Freshness summary={data} />
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label={t("core.label")}>
          <span className="truncate font-mono text-base">
            {data.core.version ?? <Unknown />}
          </span>
          <span className="text-muted-foreground text-xs leading-relaxed font-normal text-pretty">
            {!known || data.core.state !== "checked"
              ? t("core.unknown")
              : data.core.latestVersion === null
                ? t("core.none")
                : t("core.available", { version: data.core.latestVersion })}
          </span>
        </Stat>
        <Stat label={t("plugin_updates")}>
          {known ? data.pluginUpdatesAvailable : <Unknown />}
        </Stat>
        <Stat
          label={t("affected")}
          tone={
            known && data.affectedComponents > 0 ? "destructive" : undefined
          }
        >
          {known ? data.affectedComponents : <Unknown />}
        </Stat>
      </dl>

      {known && (upToDate || data.unconfirmedComponents > 0) ? (
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {upToDate
            ? t("up_to_date")
            : t("unconfirmed", { count: data.unconfirmedComponents })}
        </p>
      ) : null}

      <ViewPlugins />
    </div>
  );
};

const ViewPlugins = () => {
  const t = useTranslations("admin.dashboard.widgets.system-updates");

  return (
    <AdminLink
      className="text-primary mt-auto inline-flex items-center gap-1 self-start text-sm font-medium underline-offset-4 hover:underline"
      href={ADMIN_PLUGINS_HREF}
    >
      {t("view_plugins")}
      <ArrowRightIcon aria-hidden className="size-4" />
    </AdminLink>
  );
};
