"use client";

import { FileIcon, FolderIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { FilePreview } from "@/components/files/file-preview";
import { MetadataCell } from "@/components/files/metadata-cell";
import { ContentDataTable } from "@/components/table/content";
import { UserFormat } from "@/components/user-format";
import { formatBytes } from "@/lib/format-bytes";

import type { DeleteAdminFile, DeleteAdminFiles } from "./files-delete";
import type { AdminFileRow, AdminFilesPage } from "./files-query";

import { FileRowActions } from "./actions/file-row-actions";
import { FilesBulkActions } from "./actions/files-bulk-actions";

/**
 * Every file uploaded to the installation, as a table both frameworks render.
 *
 * The nine columns, the preview, the metadata popover, the uploader, the empty
 * state and which columns sort - all shared. Fetching, translation and the two
 * deletes are lifted out to whoever is rendering it.
 *
 *     Next.js         files-table-view.tsx        fetch + notFound + server actions
 *     TanStack Start  routes/_admin/…/system/files  loader + useSuspenseQuery + browser deletes
 *                                       \       /
 *                                 FilesTableContent
 *
 * ## What it does not own
 *
 * **Permissions.** `canDelete` and `canDownload` arrive as props rather than
 * being read from the permission context here, and that is deliberate: the
 * Next.js page resolves them on the server with `checkAdminPermissionApi`, and
 * reading them from a React context instead would suspend this component on a
 * promise the AdminCP layout is still holding. The TanStack route reads them
 * from the same admin session the guard already resolved. Either way they hide a
 * control - the API re-checks both tuples on the request itself.
 *
 * **Deleting.** Two callbacks, because the two frameworks genuinely differ: one
 * ends in `revalidatePath`, the other in a query invalidation. What they share -
 * the `409` handling, the force pass, the bulk accounting - is `files-delete.ts`
 * and `lib/files/`, so the difference really is only the last line.
 *
 * **Navigating.** Sorting, paging and searching rewrite the URL, and this
 * component never learns how; the caller mounts the navigation seam.
 */
export const FilesTableContent = ({
  canDelete,
  canDownload,
  data,
  onDeleteFile,
  onDeleteFiles,
}: {
  canDelete: boolean;
  canDownload: boolean;
  data: AdminFilesPage;
  onDeleteFile: DeleteAdminFile;
  onDeleteFiles: DeleteAdminFiles;
}) => {
  const t = useTranslations("admin.system.files");

  return (
    <ContentDataTable<AdminFileRow>
      bulkActions={
        canDelete ? (
          <FilesBulkActions onDeleteFiles={onDeleteFiles} />
        ) : undefined
      }
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
          accessorKey: "user",
          header: t("list.uploadedBy"),
          cell: ({ row }) =>
            row.user ? (
              <UserFormat format user={row.user} />
            ) : (
              <span className="text-muted-foreground">{t("anonymous")}</span>
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
          cell: ({ row }) =>
            canDownload || canDelete ? (
              <FileRowActions
                canDelete={canDelete}
                canDownload={canDownload}
                id={row.id}
                name={row.name}
                onDelete={onDeleteFile}
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
