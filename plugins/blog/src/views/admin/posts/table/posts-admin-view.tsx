import { Avatar } from "@vitnode/core/components/avatar";
import { DateFormat } from "@vitnode/core/components/date-format";
import { DataTable } from "@vitnode/core/components/table/data-table";
import { fetcher } from "@vitnode/core/lib/fetcher";
import { getLangValue } from "@vitnode/core/lib/helpers/multi-lang";
import { getLocale, getTranslations } from "next-intl/server";

import { postsModule } from "@/api/modules/posts/posts.module";

import { DeleteAction } from "./actions/delete/delete-action";
import { EditAction } from "./actions/edit-action";

export const PostsAdminView = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const t = await getTranslations("@vitnode/blog.admin.posts.table");
  const locale = await getLocale();
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
          accessorKey: "title",
          header: t("title"),
        },
        {
          accessorKey: "category",
          header: t("category"),
          className: "w-48",
          cell: ({ row }) =>
            getLangValue(row.category.titleTranslations, locale) ||
            row.category.titleTranslations[0]?.value ||
            "",
        },
        {
          accessorKey: "author",
          header: t("author"),
          className: "w-48",
          cell: ({ row }) =>
            row.author ? (
              <div className="flex items-center gap-2">
                <Avatar size={24} user={row.author} />
                <span>{row.author.name}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
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
      edges={data.edges.map(edge => ({
        ...edge,
        title:
          getLangValue(edge.titleTranslations, locale) ||
          edge.titleTranslations[0]?.value ||
          "",
      }))}
      id="posts-table"
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
