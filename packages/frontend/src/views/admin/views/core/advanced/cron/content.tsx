'use client';

import { DateFormat } from '@/components/date-format';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { useTranslations } from 'next-intl';
import { ShowCronAdvancedAdminObj } from 'vitnode-shared/admin/advanced/cron.dto';

export const ContentCronAdvancedCoreAdmin = ({
  edges,
}: ShowCronAdvancedAdminObj) => {
  const t = useTranslations('admin.core.advanced.cron');

  return (
    <DataTable
      columns={[
        {
          id: 'name',
          title: t('name'),
        },
        {
          id: 'running',
          title: t('running.title'),
          cell: ({ row: { running } }) => {
            if (running) {
              return <Badge>{t('running.enabled')}</Badge>;
            }

            return <Badge variant="outline">{t('running.disabled')}</Badge>;
          },
        },
        {
          id: 'schedule',
          title: t('schedule'),
        },
        {
          id: 'last_execution',
          title: t('last_execution.title'),
          cell: ({ row: { last_execution } }) => {
            if (!last_execution) {
              return (
                <span className="text-muted-foreground italic">
                  {t('last_execution.never')}
                </span>
              );
            }

            return <DateFormat date={last_execution} showFullDate />;
          },
        },
        {
          id: 'next_date',
          title: t('next_date'),
          cell: ({ row: { next_date } }) => {
            return <DateFormat date={next_date} showFullDate />;
          },
        },
      ]}
      data={edges.map(item => ({
        ...item,
        id: item.name,
      }))}
      defaultSorting={{
        sortDirection: 'desc',
        sortBy: 'next_date',
      }}
    />
  );
};
