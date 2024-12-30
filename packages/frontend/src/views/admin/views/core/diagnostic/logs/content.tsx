'use client';

import { DateFormat } from '@/components/date-format';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { useTranslations } from 'next-intl';
import { ShowLogsAdminObj } from 'vitnode-shared/admin/logs.dto';

import { ActionsLogsDiagnosticTools } from './actions/actions';

export const ContentLogsDiagnosticTools = ({
  edges,
  page_info,
}: ShowLogsAdminObj) => {
  const t = useTranslations('admin.core.diagnostic.error_logs');

  return (
    <DataTable
      columns={[
        {
          id: 'name',
          title: t('name'),
        },
        {
          id: 'url',
          title: t('url'),
          cell: ({ row }) => {
            return (
              <div className="flex items-center gap-2">
                <Badge className="h-6">{row.method}</Badge> {row.url}
              </div>
            );
          },
        },
        {
          id: 'message',
          title: t('message'),
          cell: ({ row }) => {
            return <span className="line-clamp-1 max-w-xs">{row.message}</span>;
          },
        },
        {
          id: 'created_at',
          title: t('created'),
          cell: ({ row }) => {
            return <DateFormat date={row.created_at} />;
          },
        },
        {
          id: 'actions',
          cell: ({ row }) => {
            return <ActionsLogsDiagnosticTools {...row} />;
          },
        },
      ]}
      data={edges}
      defaultSorting={{
        sortBy: 'created_at',
        sortDirection: 'desc',
      }}
      pageInfo={page_info}
    />
  );
};
