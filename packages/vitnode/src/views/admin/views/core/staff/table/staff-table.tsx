import { ShieldUserIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { adminModule } from "@/api/modules/admin/admin.module";
import { DateFormat } from "@/components/date-format";
import { RoleFormat } from "@/components/role-format";
import { DataTable } from "@/components/table/data-table";
import { Badge } from "@/components/ui/badge";
import { fetcher } from "@/lib/fetcher";

import { StaffRowActions } from "./actions/staff-row-actions";
import { StaffUserFormat } from "./staff-user-format";

interface StaffTableAdminProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  type: "admins" | "moderators";
}

export const StaffTableAdmin = async ({
  type,
  searchParams,
}: StaffTableAdminProps) => {
  const [t, tType] = await Promise.all([
    getTranslations("admin.staff.table"),
    getTranslations(`admin.staff.${type}`),
  ]);
  const query = await searchParams;
  const res =
    type === "moderators"
      ? await fetcher(adminModule, {
          path: "/moderators",
          method: "get",
          module: "admin/staff",
          args: { query },
          withPagination: true,
        })
      : await fetcher(adminModule, {
          path: "/admins",
          method: "get",
          module: "admin/staff",
          args: { query },
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
          id: "role",
          label: t("role"),
          cell: ({ row }) =>
            row.role ? (
              <RoleFormat role={row.role} />
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
        {
          id: "user",
          label: t("user"),
          cell: ({ row }) =>
            row.user ? (
              <StaffUserFormat user={row.user} />
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
        {
          id: "unrestricted",
          label: t("permissions"),
          cell: ({ row }) =>
            row.unrestricted ? (
              <Badge>{t("unrestricted")}</Badge>
            ) : (
              <Badge variant="secondary">{t("restricted")}</Badge>
            ),
        },
        {
          id: "updatedAt",
          label: t("updatedAt"),
          cell: ({ row }) => <DateFormat date={row.updatedAt} />,
        },
        {
          id: "actions",
          label: "",
          className: "w-10",
          cell: ({ row }) => (
            <StaffRowActions
              id={row.id}
              protected={row.protected}
              self={row.self}
              type={type === "admins" ? "admin" : "moderator"}
            />
          ),
        },
      ]}
      customNoResults={{
        title: tType("noResults.title"),
        description: tType("noResults.description"),
        icon: <ShieldUserIcon />,
      }}
      edges={data.edges}
      id={`staff-${type}-table`}
      order={{
        columns: ["updatedAt"],
        defaultOrder: {
          column: "updatedAt",
          order: "desc",
        },
      }}
      pageInfo={data.pageInfo}
    />
  );
};
