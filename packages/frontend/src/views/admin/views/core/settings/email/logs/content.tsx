'use client';

import { DateFormat } from '@/components/date-format';
import { DataTable } from '@/components/ui/data-table';
import { useTranslations } from 'next-intl';
import { LogsEmailSettingsAdminObj } from 'vitnode-shared/admin/settings/email.dto';

import { ActionsLogsEmailSettingsAdmin } from './actions/actions';

export const ContentLogsEmailSettingsAdmin = ({
  edges,
  page_info,
}: LogsEmailSettingsAdminObj) => {
  const t = useTranslations('admin.core.settings.email.logs');

  return (
    <DataTable
      columns={[
        {
          id: 'id',
          title: t('id'),
        },
        {
          id: 'to',
          title: t('to'),
        },
        {
          id: 'subject',
          title: t('subject'),
          cell: ({ row }) => {
            return <span className="line-clamp-1 max-w-xs">{row.subject}</span>;
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
          id: 'error',
          title: t('error'),
          cell: ({ row }) => {
            return <span className="line-clamp-1 max-w-xs">{row.error}</span>;
          },
        },
        {
          id: 'actions',
          cell: ({ row }) => {
            return <ActionsLogsEmailSettingsAdmin {...row} />;
          },
        },
      ]}
      data={edges}
      defaultSorting={{
        sortBy: 'created_at',
        sortDirection: 'desc',
      }}
      page_info={page_info}
    />
  );
};
