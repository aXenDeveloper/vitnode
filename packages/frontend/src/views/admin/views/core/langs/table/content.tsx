'use client';

import { DateFormat } from '@/components/date-format';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ShowLanguagesAdminObj } from 'vitnode-shared/admin/language.dto';

import { ActionsTableLangsCoreAdmin } from './actions/actions';
import { EnabledRowTableLangsCoreAdmin } from './enabled-row';

export const ContentLangsCoreAdminView = ({
  edges,
  page_info,
}: ShowLanguagesAdminObj) => {
  const t = useTranslations('admin.core.langs');
  const tCore = useTranslations('core.global');

  return (
    <DataTable
      columns={[
        {
          id: 'name',
          title: t('table.name'),
          cell: ({ row }) => {
            return (
              <div className="flex items-center gap-4">
                <span>{row.name}</span>
                {row.default && <Badge>{tCore('default')}</Badge>}
              </div>
            );
          },
        },
        {
          id: 'code',
          title: t('table.key'),
        },
        {
          id: 'locale',
          title: t('table.locale'),
        },
        {
          id: 'time_24',
          title: t('table.time_24'),
          cell: ({ row }) => {
            return row.time_24 ? tCore('yes') : tCore('no');
          },
        },
        {
          id: 'updated_at',
          title: t('table.updated'),
          sortable: true,
          cell: ({ row }) => {
            return <DateFormat date={row.updated_at} />;
          },
        },
        {
          id: 'enabled',
          title: t('table.enabled'),
          cell: ({ row }) => {
            return <EnabledRowTableLangsCoreAdmin data={row} />;
          },
        },
        {
          id: 'actions',
          cell: ({ row }) => {
            return <ActionsTableLangsCoreAdmin {...row} />;
          },
        },
      ]}
      data={edges}
      defaultSorting={{
        sortBy: 'created_at',
        sortDirection: 'desc',
      }}
      page_info={page_info}
      searchPlaceholder={t('search_placeholder')}
    />
  );
};
