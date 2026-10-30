import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon, FilterIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";

import type { ActivityFilterOptions } from "./activity-query";

import {
  activityChangedFields,
  activityChangeRows,
  ActivityChanges,
  formatActivityValue,
} from "./activity-changes";
import { ActivityDetailPending } from "./activity-detail-pending";
import {
  ActivityActor,
  ActivityAreaBadge,
  useActivityLabels,
} from "./activity-labels";
import { activityDetailQueryOptions } from "./activity-query";

const Section = ({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) => (
  <section className="flex flex-col gap-3">
    <h3 className="text-sm font-semibold text-balance">{title}</h3>
    {children}
  </section>
);

const Fact = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <div className="flex min-w-0 flex-col gap-1">
    <dt className="text-muted-foreground text-xs font-medium uppercase">
      {label}
    </dt>
    <dd className="min-w-0 text-sm leading-relaxed">{children}</dd>
  </div>
);

/**
 * The body of the detail sheet: who, when, where and what changed, with the
 * content revision the entry points at when there is one.
 */
export const ActivityDetailContent = ({
  id,
  onFilterActor,
  plugins,
}: {
  id: number;
  /** Narrows the list to this entry's actor; omitted where there is no list. */
  onFilterActor?: (actor: { id: number; name: string }) => void;
  plugins: ActivityFilterOptions["plugins"];
}) => {
  const t = useTranslations("core.activity_logs.detail");
  const labels = useActivityLabels(plugins);
  const { data: entry, isError } = useQuery(activityDetailQueryOptions(id));

  if (isError) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed" role="alert">
        {t("not_found")}
      </p>
    );
  }
  if (!entry) return <ActivityDetailPending />;

  const changes = activityChangeRows(entry.changes, name =>
    labels.field(entry, name),
  );
  const revisionRows = (entry.revision?.fields ?? []).map(field => ({
    after: field.after,
    before: field.before,
    label: labels.field(entry, field.name),
    name: field.name,
  }));
  const changedNames = activityChangedFields(entry.metadata);
  const { changedFields: _changedFields, locale, ...metadata } = entry.metadata;

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Fact label={t("actor")}>
          <ActivityActor entry={entry} linkToAdmin />
        </Fact>
        <Fact label={t("date")}>
          <DateFormat date={entry.createdAt} showFullDate />
        </Fact>
        <Fact label={t("area")}>
          <ActivityAreaBadge area={entry.area} />
        </Fact>
        <Fact label={t("plugin")}>{labels.plugin(entry.pluginId)}</Fact>
        <Fact label={t("target")}>
          <span className="break-words">
            {labels.target(entry)}
            {typeof locale === "string" ? (
              <Badge className="ms-2" variant="outline">
                {locale}
              </Badge>
            ) : null}
          </span>
        </Fact>
        {entry.scope ? (
          <Fact label={t("scope")}>
            <span className="font-mono text-xs">
              {entry.scope.family}:{entry.scope.id}
            </span>
          </Fact>
        ) : null}
      </dl>

      <div className="flex flex-wrap gap-2">
        {entry.targetHref ? (
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            to={entry.targetHref}
          >
            <ExternalLinkIcon aria-hidden />
            {t("open_target")}
          </Link>
        ) : null}
        {onFilterActor && entry.actor ? (
          <Button
            onClick={() => {
              if (entry.actor) onFilterActor(entry.actor);
            }}
            size="sm"
            variant="ghost"
          >
            <FilterIcon aria-hidden />
            {t("filter_actor")}
          </Button>
        ) : null}
      </div>

      <Section title={t("changes")}>
        {changedNames.length > 0 &&
        changes.length === 0 &&
        revisionRows.length === 0 ? (
          <ul className="flex flex-wrap gap-2">
            {changedNames.map(name => (
              <li key={name}>
                <Badge variant="secondary">{labels.field(entry, name)}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <ActivityChanges rows={[...changes, ...revisionRows]} />
        )}
      </Section>

      {entry.revision ? (
        <Section title={t("revision")}>
          {entry.revision.available && entry.revision.version !== null ? (
            <p className="text-sm leading-relaxed">
              {t("revision_version", { version: entry.revision.version })}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t("revision_unavailable")}
            </p>
          )}
        </Section>
      ) : null}

      {Object.keys(metadata).length > 0 ? (
        <Section title={t("metadata")}>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries(metadata).map(([key, value]) => (
              <Fact key={key} label={labels.field(entry, key)}>
                <span className="font-mono text-xs break-words">
                  {formatActivityValue(value)}
                </span>
              </Fact>
            ))}
          </dl>
        </Section>
      ) : null}

      {entry.ipAddress || entry.correlationId ? (
        <Section title={t("technical")}>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {entry.ipAddress ? (
              <Fact label={t("ip_address")}>
                <span className="font-mono text-xs">{entry.ipAddress}</span>
              </Fact>
            ) : null}
            {entry.correlationId ? (
              <Fact label={t("correlation_id")}>
                <span className="font-mono text-xs break-all">
                  {entry.correlationId}
                </span>
              </Fact>
            ) : null}
          </dl>
        </Section>
      ) : null}
    </div>
  );
};

export default ActivityDetailContent;
