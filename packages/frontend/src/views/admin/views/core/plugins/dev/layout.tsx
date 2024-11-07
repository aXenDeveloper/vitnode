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

import { getPluginDataAdmin } from './query-api';

interface Props {
  children: React.ReactNode;
  params: Promise<{
    code: string;
  }>;
}

export async function generateMetadataDevPluginAdminLayout({
  params,
}: Props): Promise<Metadata> {
  const { code } = await params;
  const data = await getPluginDataAdmin(code);
  const defaultTitle = data.name;

  return {
    title: {
      template: `%s - ${defaultTitle}`,
      absolute: defaultTitle,
    },
  };
}

export const DevPluginAdminLayout = async ({ params, children }: Props) => {
  const { code } = await params;
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
    <>
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
        {/* <ActionsDevPluginAdmin {...plugin} /> */}
      </HeaderContent>

      {/* <TabsDevPluginAdmin code={code} /> */}

      <Card className="p-6">{children}</Card>
    </>
  );
};
