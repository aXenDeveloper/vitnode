import React from 'react';

import { AdvancedFilterToolbarDataTable } from './advanced-filter/advanced-filter-toolbar-data-table';
import { SearchToolbarDataTable } from './search';

export interface ToolbarDataTableProps {
  advancedFilters?: React.ReactNode;
  filters?: React.ReactNode;
  searchPlaceholder?: string;
  startTransition: React.TransitionStartFunction;
}

export const ToolbarDataTable = ({
  advancedFilters,
  filters,
  searchPlaceholder,
  startTransition,
}: ToolbarDataTableProps) => {
  if (!searchPlaceholder && filters && filters && advancedFilters) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {searchPlaceholder && (
        <SearchToolbarDataTable
          searchPlaceholder={searchPlaceholder}
          startTransition={startTransition}
        />
      )}
      {filters}

      {advancedFilters && (
        <AdvancedFilterToolbarDataTable>
          {advancedFilters}
        </AdvancedFilterToolbarDataTable>
      )}
    </div>
  );
};
