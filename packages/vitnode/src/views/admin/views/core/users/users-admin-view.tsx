import { MailIcon, UserSearchIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { DataTable } from "@/components/table/data-table";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { fetcher } from "@/lib/fetcher";

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
          id: "name",
          label: t("user"),
          cell: ({ row }) => (
            <div className="flex items-center gap-3">
              <Avatar size={32} user={row} />

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{row.name}</span>
                  {!row.emailVerified && (
                    <TooltipWithContent text={t("emailNotVerified")}>
                      <MailIcon className="text-destructive size-4" />
                    </TooltipWithContent>
                  )}
                </div>
                <span className="text-muted-foreground text-sm">
                  {row.email}
                </span>
              </div>
            </div>
          ),
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
        icon: <UserSearchIcon />,
      }}
      edges={data.edges}
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
