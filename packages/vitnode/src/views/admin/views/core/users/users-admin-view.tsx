import { middlewareModule } from '@/api/modules/middleware/middleware.module';
import {
  DataTable,
  SearchParamsDataTable,
} from '@/components/table/data-table';
import { fetcher } from '@/lib/fetcher';

export const UsersAdminView = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParamsDataTable>;
}) => {
  const query = await searchParams;
  const res = await fetcher(middlewareModule, {
    path: '/test',
    method: 'get',
    module: 'middleware',
    args: {
      query,
    },
    withPagination: true,
  });
  const data = await res.json();

  return (
    <div className="container mx-auto p-4">
      <DataTable
        columns={[
          { id: 'id', label: 'Id' },
          { id: 'createdAt', label: 'Created at' },
        ]}
        edges={data.edges}
        pageInfo={data.pageInfo}
      />
    </div>
  );
};
