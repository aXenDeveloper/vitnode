import { TriangleAlertIcon, XIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { debugAdminModule } from '@/api/modules/admin/debug/debug.admin.module';
import { DateFormat } from '@/components/date-format';
import { DataTable } from '@/components/table/data-table';
import { Badge } from '@/components/ui/badge';
import { fetcher } from '@/lib/fetcher';

export const DebugAdminView = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const t = await getTranslations('admin.debug.logs');
  const query = await searchParams;
  const res = await fetcher(debugAdminModule, {
    prefixPath: '/admin',
    path: '/logs',
    method: 'get',
    module: 'debug',
    args: {
      query,
    },
    withPagination: true,
  });
  const data = await res.json();

  return (
    <DataTable
      columns={[
        {
          id: 'id',
          label: t('id'),
          className: 'w-24',
        },
        {
          id: 'type',
          label: t('type'),
          className: 'w-48',
          cell: ({ row }) => {
            if (row.type === 'warn') {
              return (
                <Badge className="bg-warn/10 border-warn/50 text-warn">
                  <TriangleAlertIcon /> {t(`types.${row.type}`)}
                </Badge>
              );
            }

            if (row.type === 'error') {
              return (
                <Badge className="bg-destructive/10 border-destructive/50 text-destructive">
                  <XIcon /> {t(`types.${row.type}`)}
                </Badge>
              );
            }

            return <Badge>{t(`types.${row.type}`)}</Badge>;
          },
        },
        {
          id: 'pluginId',
          label: t('plugin'),
          className: 'w-48',
        },
        {
          id: 'createdAt',
          label: t('created_at'),
          cell: ({ row }) => <DateFormat date={row.createdAt} showFullDate />,
        },
        {
          id: 'content',
          label: t('content'),
          cell: ({ row }) => {
            const CHARACTERS = 50;
            const content = row.content;
            const isLong = content.length > CHARACTERS;
            const displayContent = isLong
              ? content.slice(0, CHARACTERS) + '...'
              : content;

            return <span>{displayContent}</span>;
          },
        },
        {
          id: 'actions',
          label: '',
          cell: ({ row }) => <span>actions</span>,
        },
      ]}
      edges={data.edges.map(edge => ({ ...edge }))}
      order={{
        columns: ['createdAt', 'pluginId', 'type'],
        defaultOrder: {
          column: 'createdAt',
          order: 'desc',
        },
      }}
      pageInfo={data.pageInfo}
    />
  );
};
