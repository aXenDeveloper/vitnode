"use client";

import { FileIcon, FolderIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { FilePreview } from "@/components/files/file-preview";
import { MetadataCell } from "@/components/files/metadata-cell";
import { ContentDataTable } from "@/components/table/content";
import { formatBytes } from "@/lib/format-bytes";

import type { DeleteMyFile, DeleteMyFiles } from "./my-files-delete";
import type { MyFile, MyFilesPage } from "./my-files-query";

import { MyFileRowActions } from "./actions/file-row-actions";
import { MyFilesBulkActions } from "./actions/files-bulk-actions";

/**
 * The visitor's own files, as a table both frameworks render.
 *
 * Everything that used to make this a Next.js Server Component has been taken
 * out and turned into a parameter: it no longer fetches, no longer calls
 * `getTranslations`, and no longer reaches for `notFound()`. What is left is the
 * part that was always worth sharing - the eight columns, the preview, the
 * metadata popover, the relative date, the empty state, and which columns are
 * sortable - and the three things it cannot resolve for itself arrive as props.
 *
 *     Next.js         my-files-table-view.tsx   fetch + notFound + server actions
 *     TanStack Start  routes/_authenticated/files  loader + useQuery + browser deletes
 *                                    \       /
 *                              MyFilesTableContent
 *
 * ## What it does not own
 *
 * **Fetching.** It is handed a page. Which page, and how it was fetched, is
 * `my-files-query.ts`'s - the same definition a TanStack loader warms and a
 * Next.js Server Component awaits.
 *
 * **Deleting.** Two callbacks, because the two frameworks genuinely differ: one
 * ends in `revalidatePath`, the other in a query invalidation, and neither can
 * be expressed in the other's runtime. What they share - the `409` handling, the
 * force pass, the bulk accounting - is in `my-files-delete.ts` and in
 * `lib/files/`, so the difference really is only the last line.
 *
 * **Navigating.** Sorting, paging and searching rewrite the URL, and this
 * component never learns how. `ContentDataTable`'s controls read that from
 * `DataTableNavigationProvider`, which the caller mounts - `DataTable` does it
 * for Next.js, a TanStack route does it with `router.navigate`. Rendering
 * `ContentDataTable` rather than `DataTable` is the whole of the difference:
 * `DataTable` *is* the Next.js wiring.
 *
 * ## The one thing this costs Next.js
 *
 * `"use client"`, so the eight `cell` functions run in the browser rather than
 * on the server as they did - which is what `DataTable` passing its table as
 * `children` exists to preserve for the AdminCP's tables. It is paid here and
 * nowhere else, and it is close to free on this particular table: `FilePreview`,
 * `MetadataCell`, `DateFormat` and both action components were already client
 * components, so the only thing that newly reaches the browser is the column
 * list itself. The rendered HTML is unchanged, because Next.js server-renders
 * client components too.
 *
 * The alternative was a second set of columns for Next.js to render on the
 * server, which is the duplication this whole file exists to remove.
 */
export const MyFilesTableContent = ({
  data,
  onDeleteFile,
  onDeleteFiles,
}: {
  data: MyFilesPage;
  onDeleteFile: DeleteMyFile;
  onDeleteFiles: DeleteMyFiles;
}) => {
  const t = useTranslations("core.files");

  return (
    <ContentDataTable<MyFile>
      bulkActions={<MyFilesBulkActions onDeleteFiles={onDeleteFiles} />}
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
          cell: ({ row }) => (
            <MyFileRowActions
              id={row.id}
              name={row.name}
              onDelete={onDeleteFile}
            />
          ),
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
