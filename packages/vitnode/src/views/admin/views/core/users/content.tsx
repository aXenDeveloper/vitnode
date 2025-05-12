import { adminModule } from '@/api/modules/admin/admin.module';
import { Avatar } from '@/components/avatar';
import { DateFormat } from '@/components/date-format';
import { DataTable, DataTableSkeleton } from '@/components/table/data-table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { fetcher } from '@/lib/fetcher';
import { MailIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import React from 'react';

import type { UsersAdminView } from './users-admin-view';

export const ContentUsersAdmin = async ({
  searchParams,
}: React.ComponentProps<typeof UsersAdminView>) => {
  const t = await getTranslations('admin.user.list');
  const query = await searchParams;
  const res = await fetcher(adminModule, {
    path: '/list',
    method: 'get',
    module: 'admin/users',
    args: {
      query,
    },
    withPagination: true,
  });
  const data = await res.json();

  return (
    <div className="container mx-auto p-4">
      <React.Suspense fallback={<DataTableSkeleton columns={2} />}>
        <DataTable
          columns={[
            {
              id: 'name',
              label: t('user'),
              cell: ({ row }) => (
                <div className="flex items-center gap-3">
                  <Avatar size={32} user={row} />

                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.name}</span>
                      {!row.emailVerified && (
                        <Tooltip>
                          <TooltipTrigger>
                            <MailIcon className="text-destructive size-4" />
                          </TooltipTrigger>
                          <TooltipContent>
                            {t('emailNotVerified')}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <span className="text-muted-foreground text-sm">
                      {row.email}
                    </span>
                  </div>
                </div>
              ),
            },
            {
              id: 'createdAt',
              label: t('createdAt'),
              cell: ({ row }) => <DateFormat date={row.createdAt} />,
            },
          ]}
          edges={data.edges}
          order={{
            columns: ['createdAt', 'name'],
            defaultOrder: {
              column: 'createdAt',
              order: 'desc',
            },
          }}
          pageInfo={data.pageInfo}
        />
      </React.Suspense>
    </div>
  );
};
