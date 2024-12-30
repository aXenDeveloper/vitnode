import { fetcher } from '@/api/fetcher';
import {
  getPaginationTool,
  SearchParamsPagination,
} from '@/helpers/get-pagination-tool';
import {
  ShowLogsAdminObj,
  ShowLogsAdminQuery,
} from 'vitnode-shared/admin/logs.dto';

import { ContentLogsDiagnosticTools } from './content';

const getData = async (query: ShowLogsAdminQuery) => {
  const { data } = await fetcher<ShowLogsAdminObj, ShowLogsAdminQuery>({
    url: '/admin/logs',
    query,
  });

  return data;
};

export const LogsDiagnosticToolsView = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParamsPagination>;
}) => {
  const variables = await getPaginationTool({
    searchParams,
  });
  const data = await getData(variables);

  return <ContentLogsDiagnosticTools {...data} />;
};
