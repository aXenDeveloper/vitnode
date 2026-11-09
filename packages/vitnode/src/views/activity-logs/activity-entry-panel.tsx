import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon, FilterIcon, LockIcon } from "lucide-react";
import { useFormatter, useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";

import type { ActivityChangeRow } from "./activity-changes";
import type { ActivityDetail, ActivityFilterOptions } from "./activity-query";

import {
  activityChangedFields,
  activityChangeRows,
  ActivityChangeValue,
  activityMetadataChangeRows,
  formatActivityValue,
  isEmptyActivityValue,
} from "./activity-changes";
import { ActivityDetailPending } from "./activity-detail-pending";
import { useActivityLabels } from "./activity-labels";
import { activityDetailQueryOptions } from "./activity-query";

const LISTED_SEPARATELY = new Set(["changedFields", "locale"]);

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const FactValue = ({ value }: { value: unknown }) => {
  const format = useFormatter();

  if (typeof value === "string" && ISO_DATE_TIME.test(value)) {
    return (
      <span>
        {format.dateTime(new Date(value), {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </span>
    );
  }

  return <span className="font-mono">{formatActivityValue(value)}</span>;
};

const ChangesTable = ({ rows }: { rows: ActivityChangeRow[] }) => {
  const t = useTranslations("core.activity_logs.detail");

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-muted-foreground text-xs">
          <th className="w-1/3 pe-4 pb-2 text-start font-normal" scope="col">
            {t("field")}
          </th>
          <th className="w-1/3 pe-4 pb-2 text-start font-normal" scope="col">
            {t("before")}
          </th>
          <th className="w-1/3 pb-2 text-start font-normal" scope="col">
            {t("after")}
          </th>
        </tr>
      </thead>
      <tbody className="divide-foreground/5 divide-y">
        {rows.map(row => (
          <tr className="align-top" key={row.name}>
            <th className="py-2 pe-4 text-start font-medium" scope="row">
              {row.label}
            </th>
            {row.redacted ? (
              <td className="text-muted-foreground py-2" colSpan={2}>
                <span className="inline-flex items-center gap-1.5">
                  <LockIcon aria-hidden className="size-3.5" />
                  {t("redacted")}
                </span>
              </td>
            ) : (
              <>
                <td className="text-muted-foreground py-2 pe-4">
                  <ActivityChangeValue value={row.before} />
                </td>
                <td className="py-2">
                  <ActivityChangeValue value={row.after} />
                </td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const useEntryContent = (
  entry: ActivityDetail,
  plugins: ActivityFilterOptions["plugins"],
) => {
  const labels = useActivityLabels(plugins);
  const field = (name: string) => labels.field(entry, name);
  const pairs = activityMetadataChangeRows(entry.metadata, field);
  const revisionRows = (entry.revision?.fields ?? []).map(revisionField => ({
    after: revisionField.after,
    before: revisionField.before,
    label: field(revisionField.name),
    name: revisionField.name,
  }));
  const rows = [
    ...activityChangeRows(entry.changes, field),
    ...pairs.rows,
    ...revisionRows,
  ];
  const changedNames = rows.length ? [] : activityChangedFields(entry.metadata);
  const facts = Object.entries(entry.metadata)
    .filter(
      ([key, value]) =>
        !LISTED_SEPARATELY.has(key) &&
        !pairs.keys.has(key) &&
        !isEmptyActivityValue(value),
    )
    .map(([key, value]) => ({ key, label: field(key), value }));

  return { changedNames, facts, labels, rows };
};

/**
 * The details of one Activity Logs entry, opened in place under its row: what
 * changed as a field / before / after table, the rest of what the operation
 * recorded, and one line of where, when and from which request.
 */
export const ActivityEntryPanel = ({
  entry: { id },
  onFilterActor,
  plugins,
  showArea,
}: {
  entry: { id: number };
  /** Narrows the list to this entry's actor. */
  onFilterActor?: (actor: { id: number; name: string }) => void;
  plugins: ActivityFilterOptions["plugins"];
  /** Names the area in the footer - the admins' log, where it varies. */
  showArea: boolean;
}) => {
  const t = useTranslations("core.activity_logs.detail");
  const { data: entry, isError } = useQuery(activityDetailQueryOptions(id));

  if (isError) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed" role="alert">
        {t("not_found")}
      </p>
    );
  }
  if (!entry) return <ActivityDetailPending />;

  return (
    <ActivityEntryPanelContent
      entry={entry}
      onFilterActor={onFilterActor}
      plugins={plugins}
      showArea={showArea}
    />
  );
};

const ActivityEntryPanelContent = ({
  entry,
  onFilterActor,
  plugins,
  showArea,
}: {
  entry: ActivityDetail;
  onFilterActor?: (actor: { id: number; name: string }) => void;
  plugins: ActivityFilterOptions["plugins"];
  showArea: boolean;
}) => {
  const t = useTranslations("core.activity_logs.detail");
  const { changedNames, facts, labels, rows } = useEntryContent(entry, plugins);
  const {
    actor,
    metadata: { locale },
  } = entry;

  return (
    <div className="flex flex-col gap-4">
      {rows.length ? <ChangesTable rows={rows} /> : null}
      {changedNames.length ? (
        <ul aria-label={t("changes")} className="flex flex-wrap gap-2">
          {changedNames.map(name => (
            <li key={name}>
              <Badge variant="secondary">{labels.field(entry, name)}</Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {!rows.length && !changedNames.length && !facts.length ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("no_changes")}
        </p>
      ) : null}

      {entry.revision ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {entry.revision.available && entry.revision.version !== null
            ? t("revision_version", { version: entry.revision.version })
            : t("revision_unavailable")}
        </p>
      ) : null}

      {facts.length ? (
        <dl
          aria-label={t("metadata")}
          className="flex flex-wrap gap-x-5 gap-y-1 text-sm leading-relaxed"
        >
          {facts.map(fact => (
            <div className="flex min-w-0 items-baseline gap-1.5" key={fact.key}>
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd className="min-w-0 break-words">
                <FactValue value={fact.value} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="border-foreground/10 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <div className="flex flex-wrap items-center gap-2">
          {entry.targetHref ? (
            <Link
              className={buttonVariants({ size: "sm", variant: "outline" })}
              to={entry.targetHref}
            >
              <ExternalLinkIcon aria-hidden />
              {t("open_target")}
            </Link>
          ) : null}
          {onFilterActor && actor ? (
            <Button
              onClick={() => {
                onFilterActor(actor);
              }}
              size="sm"
              variant="ghost"
            >
              <FilterIcon aria-hidden />
              {t("filter_actor")}
            </Button>
          ) : null}
        </div>
        <dl className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <div className="flex items-center gap-1">
            <dt className="sr-only">{t("date")}</dt>
            <dd className="tabular-nums">
              <DateFormat date={entry.createdAt} showFullDate />
            </dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="sr-only">{t("plugin")}</dt>
            <dd>
              {labels.plugin(entry.pluginId)}
              {showArea ? ` · ${labels.area(entry.area)}` : ""}
            </dd>
          </div>
          {typeof locale === "string" ? (
            <div className="flex items-center gap-1">
              <dt className="sr-only">{t("locale")}</dt>
              <dd>
                <Badge variant="outline">{locale}</Badge>
              </dd>
            </div>
          ) : null}
          {entry.scope ? (
            <div className="flex items-center gap-1">
              <dt className="sr-only">{t("scope")}</dt>
              <dd className="font-mono">
                {entry.scope.family}:{entry.scope.id}
              </dd>
            </div>
          ) : null}
          {entry.ipAddress ? (
            <div className="flex items-center gap-1">
              <dt className="sr-only">{t("ip_address")}</dt>
              <dd className="font-mono">{entry.ipAddress}</dd>
            </div>
          ) : null}
          {entry.correlationId ? (
            <div className="flex min-w-0 items-center gap-1">
              <dt className="sr-only">{t("correlation_id")}</dt>
              <dd
                className="max-w-64 truncate font-mono"
                title={entry.correlationId}
              >
                {entry.correlationId}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
};
