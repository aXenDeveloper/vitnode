import { MailIcon, UserSearchIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { RoleFormat } from "@/components/role-format";
import { DataTable } from "@/components/table/data-table";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { fetcher } from "@/lib/fetcher";

import { UsersAdminActions } from "./actions";
import { searchRolesAdmin } from "./search-roles.action.server";

export const UsersAdminView = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const t = await getTranslations("admin.user.list");
  const query = await searchParams;
  const res = await fetcher(adminModule, {
    path: "/list",
    method: "get",
    module: "admin/users",
    args: {
      query,
    },
    withPagination: true,
  });
  const data = await res.json();

  return (
    <DataTable
      columns={[
        {
          accessorKey: "name",
          header: t("user"),
          cell: ({ row }) => (
            <div className="flex items-center gap-3">
              <Avatar size={32} user={row} />

              <div className="flex flex-col">
                <span className="font-medium">{row.name}</span>
                <span className="text-muted-foreground text-sm">
                  @{row.nameCode}
                </span>
              </div>
            </div>
          ),
        },
        {
          accessorKey: "email",
          header: t("email"),
          cell: ({ row }) => {
            if (row.emailVerified) {
              return <span>{row.email}</span>;
            }

            return (
              <div className="flex items-center gap-2">
                <TooltipWithContent text={t("emailNotVerified")}>
                  <MailIcon className="text-destructive size-4" />
                </TooltipWithContent>

                <span className="text-muted-foreground italic">
                  {row.email}
                </span>
              </div>
            );
          },
        },
        {
          accessorKey: "roleId",
          header: t("roles"),
          cell: ({ row }) => (
            <div className="flex flex-col items-start gap-1">
              <RoleFormat role={row.role} />
              {row.secondaryRoles.length > 0 && (
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  {row.secondaryRoles.slice(0, 3).map(role => (
                    <RoleFormat key={role.id} role={role} />
                  ))}
                  {row.secondaryRoles.length > 3 && (
                    <span>+{row.secondaryRoles.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          ),
        },
        {
          accessorKey: "createdAt",
          header: t("createdAt"),
          cell: ({ row }) => <DateFormat date={row.createdAt} />,
        },
        {
          id: "actions",
          header: "",
          align: "right",
          className: "w-10",
          cell: ({ row }) => <UsersAdminActions {...row} />,
        },
      ]}
      customNoResults={{
        title: t("noResults.title"),
        description: t("noResults.description"),
        icon: <UserSearchIcon />,
      }}
      edges={data.edges}
      filters={[
        {
          id: "roleId",
          label: t("roles"),
          onSearch: searchRolesAdmin,
        },
      ]}
      id="users-table"
      order={{
        columns: ["createdAt", "name"],
        defaultOrder: {
          column: "createdAt",
          order: "desc",
        },
      }}
      pageInfo={data.pageInfo}
      search
      searchPlaceholder={t("searchPlaceholder")}
    />
  );
};
