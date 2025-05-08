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
          {
            id: 'id',
            label: 'Id',
            cell: ({ row, allData }) => (
              <span>
                {row.id} - all data {allData.length}
              </span>
            ),
          },
          { id: 'createdAt', label: 'Created at' },
        ]}
        edges={data.edges}
        order={{
          columns: ['createdAt', 'id'],
          defaultOrder: {
            column: 'createdAt',
            order: 'desc',
          },
        }}
        pageInfo={data.pageInfo}
      />
    </div>
  );
};
