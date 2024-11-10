'use client';

import { DateFormat } from '@/components/date-format';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { useTextLang } from '@/hooks/use-text-lang';
import { Link } from '@/navigation';
import { Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LegalsObj } from 'vitnode-shared/legal.dto';

import { DeleteContentLegalSettingsAdmin } from './actions/delete/delete';
import { EditContentLegalSettingsAdmin } from './actions/edit';

export const TableLegalSettingsAdmin = ({ edges, page_info }: LegalsObj) => {
  const t = useTranslations('admin.core.settings.legal');
  const { convertText } = useTextLang();

  return (
    <DataTable
      columns={[
        {
          title: t('title'),
          id: 'title',
          cell: ({ row }) => {
            return convertText(row.title);
          },
        },
        {
          title: t('created'),
          id: 'created_at',
          cell: ({ row }) => {
            return <DateFormat date={row.created_at} />;
          },
        },
        {
          title: t('updated'),
          id: 'updated_at',
          cell: ({ row }) => {
            return <DateFormat date={row.updated_at} />;
          },
        },
        {
          id: 'actions',
          cell: ({ row }) => {
            return (
              <>
                <Button
                  ariaLabel={t('preview')}
                  asChild
                  size="icon"
                  variant="ghost"
                >
                  <Link href={`/legal/${row.code}`} target="_blank">
                    <Eye />
                  </Link>
                </Button>

                <EditContentLegalSettingsAdmin {...row} />
                <DeleteContentLegalSettingsAdmin {...row} />
              </>
            );
          },
        },
      ]}
      data={edges}
      defaultSorting={{
        sortBy: 'updated_at',
        sortDirection: 'desc',
      }}
      pageInfo={page_info}
    />
  );
};
