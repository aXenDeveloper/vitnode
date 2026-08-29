"use client";

import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QueueStatusBadge } from "@/views/admin/views/core/advanced/queue/badges/status-badge";

import type { DebugQueueSnapshot } from "../debug-query";

/** The four counters, in the order the debug panel shows them. */
const COUNT_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

/**
 * A snapshot of the queue - four counters and whatever is currently in flight -
 * as both frameworks render it.
 *
 * Not a `DataTable`: there is no paging, no sorting and no URL state, because
 * the list is "what is happening right now" rather than a browsable history.
 * `/admin/core/advanced/queue` is the browsable one.
 */
export const QueueViewContent = ({ data }: { data: DebugQueueSnapshot }) => {
  const t = useTranslations("admin.debug.queue");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {COUNT_STATUSES.map(status => (
          <div className="rounded-lg border p-3" key={status}>
            <p className="text-muted-foreground text-sm">
              {t(`counts.${status}`)}
            </p>
            <p className="text-2xl font-semibold">{data.counts[status]}</p>
          </div>
        ))}
      </div>

      {data.active.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("list.name")}</TableHead>
                <TableHead>{t("list.queue")}</TableHead>
                <TableHead>{t("list.status")}</TableHead>
                <TableHead>{t("list.attempts")}</TableHead>
                <TableHead>{t("list.availableAt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.active.map(task => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{task.name}</span>
                      <span className="text-muted-foreground text-sm">
                        {task.pluginId}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{task.queue}</TableCell>
                  <TableCell>
                    <QueueStatusBadge status={task.status} />
                  </TableCell>
                  <TableCell>
                    {task.attempts}/{task.maxAttempts}
                  </TableCell>
                  <TableCell>
                    <DateFormat date={task.availableAt} showFullDate />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
