import { useSuspenseQuery } from "@tanstack/react-query";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAiPoints, formatAiUsd } from "@/lib/ai/format-points";

import type { AdminAiRunDetail, adminAiRunQueryOptions } from "../ai-query";

import { AiCostSourceBadge, AiRunStatusBadge, AiUsd } from "../ai-labels";

export interface AiRunDetailProps {
  id: number;
  runQuery: (id: number) => ReturnType<typeof adminAiRunQueryOptions>;
}

const Fact = ({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <dt className="text-muted-foreground text-xs">{label}</dt>
    <dd className="text-sm break-words">{value}</dd>
  </div>
);

const tokens = (value: null | number) => value ?? "—";

const AiRunSummaryContent = ({ run }: { run: AdminAiRunDetail["run"] }) => {
  const t = useTranslations("admin.ai.history.detail");
  const tOrigin = useTranslations("admin.ai.origin");
  const locale = useLocale();

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      <Fact
        label={t("status")}
        value={<AiRunStatusBadge status={run.status} />}
      />
      <Fact
        label={t("actor")}
        value={run.user ? run.user.name : tOrigin(run.actorType)}
      />
      <Fact label={t("model")} value={run.modelId ?? "—"} />
      <Fact label={t("cost")} value={<AiUsd value={run.costUsd} />} />
      <Fact
        label={t("cost_source")}
        value={<AiCostSourceBadge source={run.costSource} />}
      />
      <Fact
        label={t("charged")}
        value={
          run.chargedUsd === null
            ? "—"
            : `${formatAiUsd(run.chargedUsd, locale)} · ${formatAiPoints(run.chargedPoints, locale)} ${t("points_unit")}`
        }
      />
      <Fact
        label={t("reserved")}
        value={`${formatAiUsd(run.reservedUsd, locale)} · ${formatAiPoints(run.reservedPoints, locale)} ${t("points_unit")}`}
      />
      <Fact label={t("settlement")} value={run.settlement} />
      <Fact
        label={t("tokens")}
        value={`${tokens(run.inputTokens)} / ${tokens(run.outputTokens)}`}
      />
      <Fact
        label={t("created")}
        value={<DateFormat date={run.createdAt} showFullDate />}
      />
      <Fact
        label={t("finished")}
        value={
          run.finishedAt ? (
            <DateFormat date={run.finishedAt} showFullDate />
          ) : (
            "—"
          )
        }
      />
      <Fact label={t("prompt_version")} value={run.promptVersion} />
      {run.resourceType ? (
        <Fact
          label={t("resource")}
          value={
            <span className="font-mono text-xs">
              {run.resourceType}:{run.resourceId ?? "—"}
            </span>
          }
        />
      ) : null}
      {run.errorCode ? (
        <Fact
          label={t("error")}
          value={
            <span className="text-destructive font-mono text-xs">
              {run.errorCode}
            </span>
          }
        />
      ) : null}
      {run.accepted === null ? null : (
        <Fact
          label={t("accepted")}
          value={
            <Badge variant={run.accepted ? "success" : "outline"}>
              {run.accepted ? t("accepted_yes") : t("accepted_no")}
            </Badge>
          }
        />
      )}
    </dl>
  );
};

const AiRunCallsContent = ({ calls }: { calls: AdminAiRunDetail["calls"] }) => {
  const t = useTranslations("admin.ai.history.detail.calls");

  return (
    <section aria-labelledby="ai-run-calls" className="flex flex-col gap-2">
      <h3 className="font-medium" id="ai-run-calls">
        {t("title")}
      </h3>
      {calls.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("attempt")}</TableHead>
              <TableHead>{t("model")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="text-end">{t("tokens")}</TableHead>
              <TableHead className="text-end">{t("cost")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calls.map(call => (
              <TableRow key={call.id}>
                <TableCell className="tabular-nums">{call.attempt}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span>{call.modelId}</span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {call.provider}
                      {call.providerModelId ? `/${call.providerModelId}` : ""}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <AiRunStatusBadge status={call.status} />
                    {call.errorCode ? (
                      <span className="text-destructive font-mono text-xs">
                        {call.errorCode}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {tokens(call.inputTokens)} / {tokens(call.outputTokens)}
                </TableCell>
                <TableCell className="text-end">
                  <div className="flex flex-col items-end gap-1">
                    <AiUsd value={call.costUsd} />
                    <AiCostSourceBadge source={call.costSource} />
                    {call.costReason ? (
                      <span className="text-muted-foreground text-xs">
                        {call.costReason}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
};

const AiRunAdjustmentsContent = ({
  adjustments,
}: {
  adjustments: AdminAiRunDetail["adjustments"];
}) => {
  const t = useTranslations("admin.ai.history.detail.adjustments");
  const locale = useLocale();
  const format = useFormatter();

  if (adjustments.length === 0) return null;

  return (
    <section
      aria-labelledby="ai-run-adjustments"
      className="flex flex-col gap-2"
    >
      <h3 className="font-medium" id="ai-run-adjustments">
        {t("title")}
      </h3>
      <ul className="flex flex-col gap-2">
        {adjustments.map(adjustment => (
          <li
            className="bg-muted flex flex-col gap-1 rounded-md p-3 text-sm"
            key={adjustment.id}
          >
            <span className="tabular-nums">
              {t("change", {
                from: formatAiUsd(adjustment.previousCostUsd, locale),
                to: formatAiUsd(adjustment.newCostUsd, locale),
              })}
            </span>
            <span className="text-muted-foreground text-xs">
              {adjustment.reason} ·{" "}
              {format.dateTime(new Date(adjustment.createdAt), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export const AiRunDetailContent = ({ id, runQuery }: AiRunDetailProps) => {
  const t = useTranslations("admin.ai.history.detail");
  const { data } = useSuspenseQuery(runQuery(id));

  return (
    <div className="flex flex-col gap-6">
      <AiRunSummaryContent run={data.run} />
      <AiRunCallsContent calls={data.calls} />
      <AiRunAdjustmentsContent adjustments={data.adjustments} />
      <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
        {t("privacy")}
      </p>
    </div>
  );
};
