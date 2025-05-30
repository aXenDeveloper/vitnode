import React from 'react';

import type { SearchParamsDataTable } from '@/components/table/data-table';

import { DataTableSkeleton } from '@/components/table/data-table';

import { ContentUsersAdmin } from './content';

export const UsersAdminView = (props: {
  searchParams: Promise<SearchParamsDataTable>;
}) => {
  return (
    <div className="container mx-auto p-4">
      <React.Suspense fallback={<DataTableSkeleton columns={2} />}>
        <ContentUsersAdmin {...props} />
      </React.Suspense>
    </div>
  );
};
