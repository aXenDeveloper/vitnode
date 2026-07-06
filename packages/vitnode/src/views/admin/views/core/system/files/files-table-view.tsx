import { FileIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { filesAdminModule } from "@/api/modules/admin/files/files.admin.module";
import { DateFormat } from "@/components/date-format";
import { FilePreview } from "@/components/files/file-preview";
import { MetadataCell } from "@/components/files/metadata-cell";
import {
  DataTable,
  type SearchParamsDataTable,
} from "@/components/table/data-table";
import { UserFormat } from "@/components/user-format";
import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";
import { fetcher } from "@/lib/fetcher";
import { formatBytes } from "@/lib/format-bytes";

import { FileRowActions } from "./actions/file-row-actions";

export const FilesTableView = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParamsDataTable>;
}) => {
  const query = await searchParams;
  const [t, canDownload, canDelete, res] = await Promise.all([
    getTranslations("admin.system.files"),
    checkAdminPermissionApi({ module: "files", permission: "can_download" }),
    checkAdminPermissionApi({ module: "files", permission: "can_delete" }),
    fetcher(filesAdminModule, {
      path: "/",
      method: "get",
      module: "files",
      prefixPath: "/admin",
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
          id: "url",
          label: t("list.preview"),
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
          id: "name",
          label: t("list.name"),
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
          id: "size",
          label: t("list.size"),
          cell: ({ row }) => formatBytes(row.size),
        },
        {
          id: "dimensions",
          label: t("list.dimensions"),
          cell: ({ row }) =>
            row.dimensions ? (
              `${row.dimensions.width}x${row.dimensions.height}`
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
        {
          id: "user",
          label: t("list.uploadedBy"),
          cell: ({ row }) =>
            row.user ? (
              <UserFormat format user={row.user} />
            ) : (
              <span className="text-muted-foreground">{t("anonymous")}</span>
            ),
        },
        {
          id: "metadata",
          label: t("list.metadata"),
          cell: ({ row }) => (
            <MetadataCell
              emptyLabel={t("metadata.empty")}
              metadata={row.metadata}
              title={t("metadata.title")}
            />
          ),
        },
        {
          id: "createdAt",
          label: t("list.createdAt"),
          cell: ({ row }) => <DateFormat date={row.createdAt} />,
        },
        {
          id: "actions",
          label: "",
          className: "w-10",
          cell: ({ row }) =>
            canDownload || canDelete ? (
              <FileRowActions
                canDelete={canDelete}
                canDownload={canDownload}
                id={row.id}
                name={row.name}
              />
            ) : null,
        },
      ]}
      customNoResults={{
        title: t("noResults.title"),
        description: t("noResults.description"),
        icon: <FileIcon />,
      }}
      edges={data.edges}
      id="files-table"
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
