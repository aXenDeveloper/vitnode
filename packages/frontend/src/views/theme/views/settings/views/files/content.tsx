'use client';

import { DateFormat } from '@/components/date-format';
import { ImgFromApi } from '@/components/img-from-api';
import { buttonVariants } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CONFIG } from '@/helpers/config-with-env';
import { formatBytes } from '@/helpers/format-bytes';
import { Link } from '@/navigation';
import { Clock, Download, File } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ShowFilesSettingsAuthObj } from 'vitnode-shared/auth/settings/files.dto';

export const ContentFilesSettings = ({
  edges,
  page_info,
}: ShowFilesSettingsAuthObj) => {
  const t = useTranslations('core.settings.files');
  const tCore = useTranslations('core.global');

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
          title: t('created'),
          sortable: true,
          cell: ({ row }) => {
            return <DateFormat date={row.created_at} />;
          },
        },
        {
          id: 'file_size',
          title: t('table.file_size'),
          sortable: true,
          cell: ({ row }) => {
            return formatBytes(row.file_size);
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
            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      aria-label={tCore('download')}
                      className={buttonVariants({
                        size: 'icon',
                        variant: 'ghost',
                      })}
                      href={
                        row.width && row.height
                          ? `${CONFIG.backend_public_url}/${row.dir_folder}/${row.file_name}`
                          : `${CONFIG.backend_url}/secure_files/${row.id}?security_key=${row.security_key}`
                      }
                      target="_blank"
                    >
                      <Download />
                    </Link>
                  </TooltipTrigger>

                  <TooltipContent>{tCore('download')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
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
