'use client';

import { DataTable } from '@/components/ui/data-table';
import { useTranslations } from 'next-intl';
import { ShowMethodAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

import { ActionsContentMethodsAuthSettingsAdmin } from './actions/actions';
import { EnabledContentMethodsAuthSettingsAdmin } from './enabled';

export const ContentMethodsAuthSettingsAdmin = ({
  edges,
}: ShowMethodAuthSettingsAdminObj) => {
  const t = useTranslations('admin.core.settings.authorization.methods');

  return (
    <DataTable
      columns={[
        {
          id: 'name',
          title: t('name'),
        },
        {
          id: 'enabled',
          title: t('enabled'),
          cell: ({ row }) => {
            return <EnabledContentMethodsAuthSettingsAdmin {...row} />;
          },
        },
        {
          id: 'actions',
          cell: ({ row }) => {
            return <ActionsContentMethodsAuthSettingsAdmin {...row} />;
          },
        },
      ]}
      data={edges.map((item, index) => ({
        ...item,
        id: index,
      }))}
      defaultSorting={{
        sortBy: 'id',
        sortDirection: 'asc',
      }}
    />
  );
};
