'use client';

import { DateFormat } from '@/components/date-format';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { GroupFormat } from '@/components/ui/user/group-format';
import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { GroupsMembersAdminObj } from 'vitnode-shared/admin/members/groups.dto';

import { ActionsTableGroupsMembersAdmin } from './actions/actions';

export const TableGroupsMembersAdmin = ({
  edges,
  page_info,
}: GroupsMembersAdminObj) => {
  const t = useTranslations('admin.members.groups');

  return (
    <DataTable
      columns={[
        {
          id: 'name',
          title: t('name'),
          cell: ({ row }) => {
            return (
              <div className="flex items-center gap-4">
                <GroupFormat group={row} />
                {row.default && <Badge>{t('default')}</Badge>}
                {row.root && <Badge>{t('root')}</Badge>}
              </div>
            );
          },
        },
        {
          id: 'users_count',
          title: t('table.users_count'),
          cell: ({ row }) => {
            if (row.guest) return null;
            if (row.users_count === 0) return row.users_count;

            return (
              <Link
                href={{
                  pathname: `/admin/members/users`,
                  query: { group_id: row.id },
                }}
              >
                {row.users_count}
              </Link>
            );
          },
        },
        {
          id: 'updated_at',
          title: t('updated'),
          sortable: true,
          cell: ({ row }) => {
            return <DateFormat date={row.updated_at} />;
          },
        },
        {
          id: 'actions',
          cell: ({ row }) => {
            return <ActionsTableGroupsMembersAdmin {...row} />;
          },
        },
      ]}
      data={edges}
      defaultSorting={{
        sortBy: 'updated_at',
        sortDirection: 'desc',
      }}
      page_info={page_info}
      searchPlaceholder={t('search_placeholder')}
    />
  );
};
