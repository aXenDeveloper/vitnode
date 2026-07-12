import { ExternalLink, ShieldIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { adminModule } from "@/api/modules/admin/admin.module";
import { DateFormat } from "@/components/date-format";
import { RoleFormat } from "@/components/role-format";
import { DataTable } from "@/components/table/data-table";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { fetcher } from "@/lib/fetcher";
import { Link } from "@/lib/navigation";

import { EditAction } from "./table/actions/edit-action";

export const RolesAdminView = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const t = await getTranslations("admin.role.list");
  const query = await searchParams;
  const res = await fetcher(adminModule, {
    path: "/list",
    method: "get",
    module: "admin/roles",
    args: {
      query,
    },
    withPagination: true,
  });

  if (res.status !== 200) {
    return notFound();
  }

  const data = await res.json();

  return (
    <DataTable
      columns={[
        {
          accessorKey: "name",
          header: t("role"),
          cell: ({ row }) => <RoleFormat role={row} />,
        },
        {
          accessorKey: "usersCount",
          header: t("usersCount"),
          cell: ({ row }) => {
            if (row.usersCount === 0) {
              return <span className="text-muted-foreground">0</span>;
            }

            return (
              <TooltipWithContent text={t("openUsersTooltip")}>
                <Link
                  className="text-primary inline-flex items-center gap-2"
                  href={`/admin/core/users?roleId=${row.id}`}
                >
                  {row.usersCount} <ExternalLink className="size-4" />
                </Link>
              </TooltipWithContent>
            );
          },
        },
        {
          accessorKey: "updatedAt",
          header: t("updatedAt"),
          cell: ({ row }) => <DateFormat date={row.createdAt} />,
        },
        {
          id: "actions",
          header: "",
          align: "right",
          className: "w-10",
          cell: ({ row }) => <EditAction data={row} />,
        },
      ]}
      customNoResults={{
        title: t("noResults.title"),
        description: t("noResults.description"),
        icon: <ShieldIcon />,
      }}
      edges={data.edges}
      id="roles-table"
      order={{
        columns: ["updatedAt"],
        defaultOrder: {
          column: "updatedAt",
          order: "desc",
        },
      }}
      pageInfo={data.pageInfo}
      search
      searchPlaceholder={t("searchPlaceholder")}
    />
  );
};
