'use client';

import { DateFormat } from '@/components/date-format';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ShowPluginsAdminObj } from 'vitnode-shared/admin/plugins.dto';

import { ActionsItemPluginsAdmin } from './actions/actions';

export const ContentPluginsCoreAdmin = ({
  edges,
  page_info,
}: ShowPluginsAdminObj) => {
  const t = useTranslations('admin.core.plugins');
  const tCore = useTranslations('core.global');

  return (
    <DataTable
      columns={[
        {
          id: 'name',
          title: t('name'),
          cell: ({ row }) => {
            return (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{row.name}</span>
                  {row.default && <Badge>{tCore('default')}</Badge>}
                </div>
                {row.description && (
                  <p className="text-muted-foreground max-w-80 truncate text-sm">
                    {row.description}
                  </p>
                )}
              </>
            );
          },
        },
        {
          id: 'version',
          title: t('version'),
          cell: ({ row }) => {
            if (!row.version_code) return null;

            return (
              <span className="flex gap-1">
                <span>{row.version}</span>
                <span className="text-muted-foreground">
                  ({row.version_code})
                </span>
              </span>
            );
          },
        },
        {
          id: 'author',
          title: t('author'),
          cell: ({ row }) => {
            if (row.author_url) {
              return (
                <a
                  className="flex gap-1"
                  href={row.author_url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {row.author} <ExternalLink className="size-4" />
                </a>
              );
            }

            return <span className="flex gap-1">{row.author}</span>;
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
            return <ActionsItemPluginsAdmin {...row} />;
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
