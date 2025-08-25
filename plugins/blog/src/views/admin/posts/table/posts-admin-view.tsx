import { DateFormat } from "@vitnode/core/components/date-format";
import { DataTable } from "@vitnode/core/components/table/data-table";
import { fetcher } from "@vitnode/core/lib/fetcher";
import { getTranslations } from "next-intl/server";

import { postsModule } from "@/api/modules/posts/posts.module";

import { DeleteAction } from "./actions/delete/delete-action";
import { EditAction } from "./actions/edit-action";

export const PostsAdminView = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const t = await getTranslations("@vitnode/blog.admin.posts.table");
  const query = await searchParams;
  const res = await fetcher(postsModule, {
    path: "/",
    method: "get",
    module: "posts",
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
          id: "id",
          label: "ID",
          className: "w-24",
        },
        {
          id: "title",
          label: t("title"),
        },
        {
          id: "category",
          label: t("category"),
          className: "w-48",
          cell: ({ row }) => row.category.title,
        },
        {
          id: "updatedAt",
          label: t("updated_at"),
          className: "w-48",
          cell: ({ row }) => <DateFormat date={row.updatedAt} />,
        },
        {
          id: "actions",
          label: "",
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
