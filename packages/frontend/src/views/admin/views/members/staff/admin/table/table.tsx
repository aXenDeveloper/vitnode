'use client';

import { DateFormat } from '@/components/date-format';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { GroupFormat } from '@/components/ui/user/group-format';
import { UserLink } from '@/components/ui/user/link';
import { InfinityIcon, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { AdminStaffMembersAdminObj } from 'vitnode-shared/admin/members/staff/admin.dto';

import { ActionsTableAdministratorsStaffAdmin } from './actions/actions';

export const TableAdministratorsStaffAdmin = ({
  edges,
  page_info,
  permissions,
}: AdminStaffMembersAdminObj) => {
  const t = useTranslations('admin.members.staff.admin');
  const tShared = useTranslations('admin.members.staff.shared');

  return (
    <DataTable
      columns={[
        {
          id: 'name',
          title: t('title'),
          cell: ({ row }) => {
            if ('name_seo' in row.user_or_group) {
              return <UserLink user={row.user_or_group} />;
            }

            return (
              <GroupFormat
                group={{
                  ...row.user_or_group,
                  name: row.user_or_group.group_name,
                }}
              />
            );
          },
        },
        {
          id: 'type',
          title: tShared('type'),
          cell: ({ row }) => {
            return (
              <Badge variant="outline">
                {tShared('name_seo' in row.user_or_group ? 'user' : 'group')}
              </Badge>
            );
          },
        },
        {
          id: 'updated_at',
          title: tShared('updated'),
          sortable: true,
          cell: ({ row }) => {
            return <DateFormat date={row.updated_at} />;
          },
        },
        {
          id: 'permissions',
          title: tShared('permissions'),
          cell: ({ row }) => {
            const unrestricted = row.permissions.length === 0;

            return (
              <Badge
                className="[&>svg]:size-4"
                variant={unrestricted ? 'default' : 'secondary'}
              >
                {unrestricted ? <InfinityIcon /> : <ShieldAlert />}
                {tShared(unrestricted ? 'unrestricted.title' : 'restricted')}
              </Badge>
            );
          },
        },
        {
          id: 'actions',
          cell: ({ row }) => {
            if (row.protected) return null;

            return (
              <ActionsTableAdministratorsStaffAdmin
                data={row}
                permissions={permissions}
              />
            );
          },
        },
      ]}
      data={edges}
      defaultSorting={{
        sortBy: 'updated_at',
        sortDirection: 'desc',
      }}
      page_info={page_info}
    />
  );
};
