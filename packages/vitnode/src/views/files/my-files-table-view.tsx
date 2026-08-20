import { FileIcon, FolderIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { userFilesModule } from "@/api/modules/users/files/files.module";
import { DateFormat } from "@/components/date-format";
import { FilePreview } from "@/components/files/file-preview";
import { MetadataCell } from "@/components/files/metadata-cell";
import {
  DataTable,
  type SearchParamsDataTable,
} from "@/components/table/data-table";
import { notFound } from "@/framework/navigation";
import { fetcher } from "@/lib/fetcher";
import { formatBytes } from "@/lib/format-bytes";

import { MyFileRowActions } from "./actions/file-row-actions";

export const MyFilesTableView = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParamsDataTable>;
}) => {
  const query = await searchParams;
  const [t, res] = await Promise.all([
    getTranslations("core.files"),
    fetcher(userFilesModule, {
      path: "/",
      method: "get",
      module: "files",
      prefixPath: "/users",
      args: { query },
      withPagination: true,
    }),
  ]);

  if (res.status !== 200) {
    return notFound();
  }

  const data = await res.json();

  return (
    <DataTable
      columns={[
        {
          accessorKey: "url",
          header: t("list.preview"),
          className: "w-16",
          cell: ({ row }) => (
            <FilePreview
              mimeType={row.mimeType}
              name={row.name}
              url={row.url}
            />
          ),
        },
        {
          accessorKey: "name",
          header: t("list.name"),
          cell: ({ row }) => (
            <div className="flex max-w-xs flex-col">
              <span className="truncate">{row.name}</span>
              <p className="text-muted-foreground truncate text-sm">
                {row.mimeType ?? row.folder}
              </p>
            </div>
          ),
        },
        {
          accessorKey: "folder",
          header: t("list.folder"),
          cell: ({ row }) => (
            <div className="text-muted-foreground flex items-center gap-2">
              <FolderIcon className="size-4 shrink-0" />
              <span className="truncate">{row.folder}</span>
            </div>
          ),
        },
        {
          accessorKey: "size",
          header: t("list.size"),
          cell: ({ row }) => formatBytes(row.size),
        },
        {
          accessorKey: "dimensions",
          header: t("list.dimensions"),
          cell: ({ row }) =>
            row.dimensions ? (
              `${row.dimensions.width}x${row.dimensions.height}`
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
        {
          accessorKey: "metadata",
          header: t("list.metadata"),
          cell: ({ row }) => (
            <MetadataCell
              emptyLabel={t("metadata.empty")}
              metadata={row.metadata}
              title={t("metadata.title")}
            />
          ),
        },
        {
          accessorKey: "createdAt",
          header: t("list.createdAt"),
          cell: ({ row }) => <DateFormat date={row.createdAt} />,
        },
        {
          id: "actions",
          header: "",
          align: "right",
          className: "w-10",
          cell: ({ row }) => <MyFileRowActions id={row.id} name={row.name} />,
        },
      ]}
      customNoResults={{
        title: t("noResults.title"),
        description: t("noResults.description"),
        icon: <FileIcon />,
      }}
      edges={data.edges}
      id="my-files-table"
      order={{
        columns: ["name", "size", "createdAt"],
        defaultOrder: {
          column: "createdAt",
          order: "desc",
        },
      }}
      pageInfo={data.pageInfo}
      search
    />
  );
};
