import { getTranslations } from "next-intl/server";

import { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";
import { DateFormat } from "@/components/date-format";
import { DataTable } from "@/components/table/data-table";
import { fetcher } from "@/lib/fetcher";

import { MoreActionSystemLogs } from "./actions/more/more";
import { BadgeStatus } from "./badges/badge-status";
import { BadgeTypeLog } from "./badges/badge-type-log";

export const getSystemLogsData = async (
  query: Record<string, string | string[] | undefined>,
) => {
  const res = await fetcher(debugAdminModule, {
    prefixPath: "/admin",
    path: "/logs",
    method: "get",
    module: "debug",
    args: {
      query,
    },
    withPagination: true,
  });

  return await res.json();
};

export const SystemLogsView = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const [t, query] = await Promise.all([
    getTranslations("admin.debug.logs"),
    searchParams,
  ]);
  const data = await getSystemLogsData(query);

  return (
    <DataTable
      columns={[
        {
          id: "pluginId",
          label: t("plugin"),
          className: "w-48",
        },
        {
          id: "type",
          label: t("type"),
          cell: ({ row }) => <BadgeTypeLog type={row.type} />,
        },
        {
          id: "statusCode",
          label: t("status_code"),
          className: "w-26",
          cell: ({ row }) => <BadgeStatus statusCode={row.statusCode} />,
        },
        {
          id: "createdAt",
          label: t("created_at"),
          cell: ({ row }) => <DateFormat date={row.createdAt} />,
        },
        {
          id: "content",
          label: t("content"),
          cell: ({ row }) => {
            const CHARACTERS = 50;
            const content = row.content;
            const isLong = content.length > CHARACTERS;
            const displayContent = isLong
              ? `${content.slice(0, CHARACTERS)}...`
              : content;

            return <span>{displayContent}</span>;
          },
        },
        {
          id: "actions",
          label: "",
          cell: ({ row }) => <MoreActionSystemLogs {...row} />,
        },
      ]}
      edges={data.edges.map(edge => ({ ...edge }))}
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
