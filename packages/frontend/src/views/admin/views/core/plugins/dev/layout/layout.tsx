import { DateFormat } from '@/components/date-format';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { HeaderContent } from '@/components/ui/header-content';
import { CONFIG } from '@/helpers/config-with-env';
import { redirect } from '@/navigation';
import { ExternalLink } from 'lucide-react';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import React from 'react';

import { getPluginDataAdmin } from '../query-api';
import { TabsDevPluginAdmin } from '../tabs';
import { ExportActionDevPluginAdmin } from './export/export';
import { WrapperDevPluginAdminLayout } from './wrapper';

interface Props {
  children: React.ReactNode;
  code: string;
}

export async function generateMetadataDevPluginAdminLayout({
  code,
}: Omit<Props, 'children'>): Promise<Metadata> {
  const data = await getPluginDataAdmin(code);
  const defaultTitle = data.name;

  return {
    title: defaultTitle,
  };
}

export const DevPluginAdminLayout = async ({ code, children }: Props) => {
  if (!CONFIG.node_development) await redirect('/admin');
  const [
    {
      author,
      author_url,
      default: isDefault,
      description,
      name,
      updated_at,
      version,
      version_code,
    },
    t,
  ] = await Promise.all([
    getPluginDataAdmin(code),
    getTranslations('core.global'),
  ]);

  return (
    <WrapperDevPluginAdminLayout
      data={{
        code,
        version,
        version_code,
        name,
      }}
    >
      <HeaderContent
        desc={
          <div>
            {description && (
              <p className="max-w-80 truncate text-sm">{description}</p>
            )}
            {version && version_code && (
              <span className="flex flex-wrap gap-1">
                <span>{version}</span>
                <span>
                  ({version_code}), <DateFormat date={updated_at} />
                </span>
              </span>
            )}
            {author_url ? (
              <a
                className="inline-flex gap-1"
                href={author_url}
                rel="noopener noreferrer"
                target="_blank"
              >
                {author} <ExternalLink className="size-4" />
              </a>
            ) : (
              <span className="flex gap-1">{author}</span>
            )}
          </div>
        }
        h1={
          <div className="flex flex-wrap items-center gap-2">
            <span>{name}</span>
            {isDefault && <Badge>{t('default')}</Badge>}
          </div>
        }
      >
        {CONFIG.node_development && <ExportActionDevPluginAdmin />}
      </HeaderContent>

      <TabsDevPluginAdmin code={code} />

      <Card className="p-6">{children}</Card>
    </WrapperDevPluginAdminLayout>
  );
};
