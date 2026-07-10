import { DateFormat } from "@vitnode/core/components/date-format";
import { DataTable } from "@vitnode/core/components/table/data-table";
import { fetcher } from "@vitnode/core/lib/fetcher";
import { getTranslations } from "next-intl/server";

import { categoriesModule } from "@/api/modules/categories/categories.module";

import { DeleteAction } from "./actions/delete/delete-action";
import { EditAction } from "./actions/edit-action";

export const CategoriesAdminView = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const t = await getTranslations("@vitnode/blog.admin.categories.table");
  const query = await searchParams;
  const res = await fetcher(categoriesModule, {
    path: "/",
    method: "get",
    module: "categories",
    args: {
      query,
    },
    withPagination: true,
    options: {
      cache: "force-cache",
    },
  });
  const data = await res.json();

  return (
    <DataTable
      columns={[
        {
          accessorKey: "id",
          header: "ID",
          className: "w-24",
        },
        {
          accessorKey: "title",
          header: t("title"),
        },
        {
          accessorKey: "updatedAt",
          header: t("updated_at"),
          className: "w-48",
          cell: ({ row }) => <DateFormat date={row.updatedAt} />,
        },
        {
          id: "actions",
          header: "",
          align: "right",
          className: "w-10",
          cell: ({ row }) => (
            <>
              <EditAction data={row} />
              <DeleteAction {...row} />
            </>
          ),
        },
      ]}
      edges={data.edges.map(edge => ({ ...edge }))}
      id="categories-table"
      order={{
        columns: ["createdAt", "updatedAt"],
        defaultOrder: {
          column: "createdAt",
          order: "desc",
        },
      }}
      pageInfo={data.pageInfo}
    />
  );
};
