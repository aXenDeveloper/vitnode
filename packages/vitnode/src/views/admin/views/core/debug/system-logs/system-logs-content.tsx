"use client";

import { useTranslations } from "use-intl";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { DateFormat } from "@/components/date-format";
import { ContentDataTable } from "@/components/table/content";

import type { DebugLogRow, DebugLogsPage } from "../debug-query";

import { MoreActionSystemLogs } from "./actions/more/more";
import { BadgeStatus } from "./badges/badge-status";
import { BadgeTypeLog } from "./badges/badge-type-log";

/** How much of a log line is shown before it is cut. */
const CONTENT_CHARACTERS = 50;

export const SystemLogsContent = ({
  data,
  LinkComponent,
}: {
  data: DebugLogsPage;
  LinkComponent: AuthLinkComponent;
}) => {
  const t = useTranslations("admin.debug.logs");

  return (
    <ContentDataTable<DebugLogRow>
      columns={[
        {
          accessorKey: "pluginId",
          header: t("plugin"),
          className: "w-48",
        },
        {
          accessorKey: "type",
          header: t("type"),
          cell: ({ row }) => <BadgeTypeLog type={row.type} />,
        },
        {
          accessorKey: "statusCode",
          header: t("status_code"),
          className: "w-26",
          cell: ({ row }) => <BadgeStatus statusCode={row.statusCode} />,
        },
        {
          accessorKey: "createdAt",
          header: t("created_at"),
          cell: ({ row }) => <DateFormat date={row.createdAt} />,
        },
        {
          accessorKey: "content",
          header: t("content"),
          cell: ({ row }) => {
            const content = row.content;
            const isLong = content.length > CONTENT_CHARACTERS;

            return (
              <span>
                {isLong
                  ? `${content.slice(0, CONTENT_CHARACTERS)}...`
                  : content}
              </span>
            );
          },
        },
        {
          id: "actions",
          header: "",
          align: "right",
          cell: ({ row }) => (
            <MoreActionSystemLogs {...row} LinkComponent={LinkComponent} />
          ),
        },
      ]}
      edges={data.edges}
      id="system-logs-table"
      order={{
        columns: ["createdAt", "pluginId", "type"],
        defaultOrder: {
          column: "createdAt",
          order: "desc",
        },
      }}
      pageInfo={data.pageInfo}
    />
  );
};
