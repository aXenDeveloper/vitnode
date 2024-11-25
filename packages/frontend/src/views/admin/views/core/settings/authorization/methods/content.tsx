'use client';

import { DataTable } from '@/components/ui/data-table';
import { ShowMethodAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';
import { EnabledContentMethodsAuthSettingsAdmin } from './enabled';
import { useTranslations } from 'next-intl';

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
          cell: () => {
            return <div>actions</div>;
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
