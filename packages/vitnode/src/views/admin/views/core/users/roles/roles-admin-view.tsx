import { ShieldIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { adminModule } from "@/api/modules/admin/admin.module";
import { DateFormat } from "@/components/date-format";
import { RoleFormat } from "@/components/role-format";
import { DataTable } from "@/components/table/data-table";
import { fetcher } from "@/lib/fetcher";

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
          id: "name",
          label: t("role"),
          cell: ({ row }) => <RoleFormat role={row} />,
        },
        {
          id: "usersCount",
          label: t("usersCount"),
          cell: ({ row }) => row.usersCount,
        },
        {
          id: "createdAt",
          label: t("createdAt"),
          cell: ({ row }) => <DateFormat date={row.createdAt} />,
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
        columns: ["createdAt"],
        defaultOrder: {
          column: "createdAt",
          order: "desc",
        },
      }}
      pageInfo={data.pageInfo}
    />
  );
};
