'use client';

import { DateFormat } from '@/components/date-format';
import { ImgFromApi } from '@/components/img-from-api';
import { DataTable } from '@/components/ui/data-table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatBytes } from '@/helpers/format-bytes';
import { Link } from '@/navigation';
import { Clock, File } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ShowFilesAdvancedAdminObj } from 'vitnode-shared/admin/advanced/files.dto';

import { ActionsFilesAdvancedCoreAdmin } from './actions/actions';

export const ContentFilesAdvancedCoreAdminView = ({
  edges,
  page_info,
}: ShowFilesAdvancedAdminObj) => {
  const t = useTranslations('core.settings.files');

  return (
    <DataTable
      columns={[
        {
          id: 'id',
          cell: ({ row }) => {
            const alt = row.file_alt ?? row.file_name;

            return (
              <div className="relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                {row.width && row.height ? (
                  <ImgFromApi
                    alt={alt}
                    className="object-cover"
                    dir_folder={row.dir_folder}
                    file_name={row.file_name}
                    fill
                    mimetype={row.mimetype}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                ) : (
                  <File className="text-muted-foreground size-8" />
                )}
              </div>
            );
          },
        },
        {
          id: 'file_name',
          title: t('name'),
          cell: ({ row }) => {
            return (
              <div>
                <span className="block max-w-80 truncate leading-tight">
                  {row.file_name_original}
                </span>
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                  <span>{row.mimetype}</span>
                  {row.width && row.height && (
                    <>
                      <span>&middot;</span>
                      <span>
                        {row.width}x{row.height}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          },
        },
        {
          id: 'created_at',
          sortable: true,
          title: t('created'),
          cell: ({ row }) => {
            return <DateFormat date={row.created_at} />;
          },
        },
        {
          id: 'file_size',
          sortable: true,
          title: t('table.file_size'),
          cell: ({ row }) => {
            return formatBytes(row.file_size);
          },
        },
        {
          id: 'user',
          title: t('table.user'),
          cell: ({ row }) => {
            if (row.user?.id) {
              return (
                <Link href={`/admin/members/users/${row.user.id}`}>
                  {row.user.name}
                </Link>
              );
            }
          },
        },
        {
          id: 'count_uses',
          title: t('table.count_uses'),
          cell: ({ row }) => {
            if (row.count_uses === 0) {
              return (
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Clock className="text-destructive size-4" />
                      </TooltipTrigger>
                      <TooltipContent>{t('temp_file')}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {row.count_uses}
                </div>
              );
            }

            return row.count_uses;
          },
        },
        {
          id: 'actions',
          cell: ({ row }) => {
            return <ActionsFilesAdvancedCoreAdmin {...row} />;
          },
        },
      ]}
      data={edges}
      defaultSorting={{
        sortBy: 'created_at',
        sortDirection: 'desc',
      }}
      pageInfo={page_info}
      searchPlaceholder={t('search')}
    />
  );
};
