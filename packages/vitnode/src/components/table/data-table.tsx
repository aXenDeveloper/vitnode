import type { DataTableProps, DataTableTMin } from "./data-table-content";

import { ErrorView } from "../../views/error/error-view";
import { ContentDataTable } from "./content";
import { NextDataTableNavigation } from "./navigation-next";

export type {
  AlignDataTable,
  ColumnDef,
  DataTableProps,
  DataTableTMin,
  SearchParamsDataTable,
} from "./data-table-content";
export { DataTableSkeleton } from "./data-table-content";

/**
 * {@link ContentDataTable}, wired to Next.js.
 *
 * The props are unchanged, so every AdminCP view and every `/files` page sees
 * exactly the component they always did. This supplies the one thing the shared
 * table cannot resolve for itself - how to change the URL - and the failure
 * screen, which is `next-intl`'s locale-aware navigation wearing two buttons.
 *
 * The provider is a client component and the table it wraps is not: passing the
 * table as `children` is what keeps it that way, so the `cell` functions in
 * `columns` are called on the server and never have to cross a serialization
 * boundary.
 */
export function DataTable<T extends DataTableTMin>(props: DataTableProps<T>) {
  if (!(props.edges && props.pageInfo)) {
    return <ErrorView code={500} />;
  }

  return (
    <NextDataTableNavigation>
      <ContentDataTable<T> {...props} />
    </NextDataTableNavigation>
  );
}
