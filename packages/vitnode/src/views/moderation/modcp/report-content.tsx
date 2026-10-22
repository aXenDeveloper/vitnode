import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { FlagIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { ReportReasonLabel } from "@/views/moderation/report-reason-label";

import type { ModcpReportDetail } from "./modcp-query";
import type { ReportPerson } from "./report-tone";

import { invalidateModcp, modcpReportQueryOptions } from "./modcp-query";
import { ModcpPluginMessages } from "./plugin-messages";
import { ReportActivity } from "./report-activity";
import { ReportSidebar } from "./report-sidebar";
import { SnapshotPeek } from "./report-snapshot-peek";
import {
  Person,
  PersonAvatar,
  PersonName,
  REASON_TEXT,
  REASON_TONE,
  StatusLozenge,
  TONE_SURFACE,
} from "./report-tone";
import { readSnapshot } from "./snapshot-view";
import { useTargetLabel } from "./status-badge";

export const ModcpReportContent = ({
  id,
  userId,
}: {
  id: number;
  userId: number;
}) => {
  const { data } = useSuspenseQuery(modcpReportQueryOptions(id));
  const snapshot = readSnapshot(data.snapshot);

  return (
    <ModcpPluginMessages
      labels={[
        data.targetLabel,
        data.pluginLabel,
        ...(snapshot?.fields.map(field => field.label) ?? []),
      ]}
    >
      <ModcpReportDetailView id={id} userId={userId} />
    </ModcpPluginMessages>
  );
};

const Section = ({
  children,
  count,
  title,
}: {
  children: React.ReactNode;
  count?: number;
  title: string;
}) => {
  const headingId = React.useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2
        className="text-foreground flex items-center gap-2 text-sm font-semibold"
        id={headingId}
      >
        {title}
        {count === undefined ? null : (
          <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-xs tabular-nums">
            {count}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
};

const LinkedReports = ({
  related,
}: {
  related: ModcpReportDetail["related"];
}) => {
  const t = useTranslations("core.moderation");

  if (related.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("modcp.detail.related.empty")}
      </p>
    );
  }

  return (
    <ul className="ring-foreground/10 divide-y overflow-hidden rounded-xl ring-1">
      {related.map(entry => (
        <li key={entry.id}>
          <Link
            className="hover:bg-muted/50 focus-visible:ring-ring/50 flex items-start gap-3 px-3.5 py-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-inset"
            to={`/modcp/reports/${entry.id}`}
          >
            {entry.reporter ? (
              <PersonAvatar
                className="mt-0.5"
                person={entry.reporter}
                size={28}
              />
            ) : null}
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  #{entry.id}
                </span>
                <span
                  className={cn(
                    "truncate font-medium",
                    entry.description
                      ? "text-foreground"
                      : "text-muted-foreground italic",
                  )}
                >
                  {entry.description ?? t("modcp.detail.linked.no_details")}
                </span>
              </span>
              <span className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
                {entry.reporter ? (
                  <>
                    <PersonName className="text-xs" person={entry.reporter} />
                    <span aria-hidden>·</span>
                  </>
                ) : null}
                <span className={cn("font-medium", REASON_TEXT)}>
                  <ReportReasonLabel code={entry.reason} />
                </span>
                <span aria-hidden>·</span>
                <DateFormat date={entry.createdAt} />
              </span>
            </span>
            <span className="mt-0.5 shrink-0">
              <StatusLozenge status={entry.status} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};

const snapshotAuthorOf = (
  snapshot: NonNullable<ReturnType<typeof readSnapshot>>,
) => {
  const first = snapshot.authors.at(0);

  return first
    ? { name: first.name, role: { color: null, prefix: null } }
    : null;
};

const ModcpReportDetailView = ({
  id,
  userId,
}: {
  id: number;
  userId: number;
}) => {
  const t = useTranslations("core.moderation.modcp.detail");
  const tRoot = useTranslations();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(modcpReportQueryOptions(id));
  const targetLabel = useTargetLabel();
  const snapshot = readSnapshot(data.snapshot);
  const { report } = data;
  const typeLabel = targetLabel(data.targetLabel, report.targetType);
  const pluginName = tRoot.has(data.pluginLabel as never)
    ? tRoot(data.pluginLabel as never)
    : report.pluginId;
  const author = data.authors.at(0) ?? null;

  const people = React.useMemo(() => {
    const map = new Map<number, ReportPerson>();
    for (const person of [
      data.reporter,
      data.assignee,
      ...data.authors,
      ...data.events.map(event => event.actor),
    ]) {
      if (person) map.set(person.id, person);
    }

    return map;
  }, [data]);

  const refresh = async () => {
    await invalidateModcp(queryClient);
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-foreground flex flex-wrap items-center gap-x-3 gap-y-2 text-2xl font-semibold tracking-tight text-balance">
          <span
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold tracking-normal",
              TONE_SURFACE[REASON_TONE],
            )}
          >
            <FlagIcon aria-hidden className="size-4" />
            <ReportReasonLabel code={report.reason} />
            <span className="sr-only">:</span>
          </span>
          {author
            ? t.rich("heading", {
                author: () => <PersonName link person={author} />,
                type: typeLabel,
              })
            : (snapshot?.title ?? t("title", { id: report.id }))}
        </h1>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="bg-card ring-foreground/5 flex min-w-0 flex-col gap-8 rounded-xl p-4 shadow-xs ring-1 md:p-6 dark:shadow-none">
          <Section title={t("sections.description")}>
            <div className="flex flex-col gap-3">
              <p
                className={cn(
                  "leading-relaxed text-pretty break-words whitespace-pre-wrap",
                  report.description
                    ? "text-foreground"
                    : "text-muted-foreground italic",
                )}
              >
                {report.description ?? t("report.no_description")}
              </p>
              <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                {data.reporter ? (
                  <Person link person={data.reporter} size={20} />
                ) : (
                  t("report.deleted_user")
                )}
                <span aria-hidden>·</span>
                <DateFormat date={report.createdAt} />
              </p>
            </div>
          </Section>

          {snapshot ? (
            <Section title={t("sections.snapshot")}>
              <SnapshotPeek
                author={author ?? snapshotAuthorOf(snapshot)}
                contentUrl={data.current.url}
                reportId={report.id}
                snapshot={snapshot}
                typeLabel={typeLabel}
              />
            </Section>
          ) : null}

          <Section count={data.related.length} title={t("sections.linked")}>
            <LinkedReports related={data.related} />
          </Section>

          <ReportActivity
            canNote={data.permissions.manage}
            events={data.events}
            id={report.id}
            me={people.get(userId) ?? null}
            onDone={refresh}
            people={people}
          />
        </article>

        <ReportSidebar
          data={data}
          onDone={refresh}
          pluginName={pluginName}
          typeLabel={typeLabel}
          userId={userId}
        />
      </div>
    </div>
  );
};
