import { fetcher } from '@/api/fetcher';
import { RevalidateTagEnum } from '@/api/revalidate-tags';
import { Card } from '@/components/ui/card';
import { getTranslations } from 'next-intl/server';
import { LegalsObj, LegalsQuery } from 'vitnode-shared/legal.dto';

import { ItemLegal } from './item';

export const getLegalData = async (query: LegalsQuery) => {
  const { data } = await fetcher<LegalsObj, LegalsQuery>({
    url: '/core/legal',
    query,
    cache: 'force-cache',
    next: {
      tags: [RevalidateTagEnum.Core_Terms_Show],
    },
  });

  return data;
};

export const generateMetadataLegal = async () => {
  const t = await getTranslations('core.legal');

  return {
    title: t('title'),
  };
};

export const LegalView = async () => {
  const [t, { edges }] = await Promise.all([
    getTranslations('core.legal'),
    getLegalData({}),
  ]);

  return (
    <div className="container my-14 flex max-w-5xl flex-col justify-between gap-10 md:flex-row">
      <div className="max-w-xs">
        <h1 className="text-3xl font-semibold leading-normal">
          {t('title_page')}
        </h1>
      </div>

      <div className="flex-1 space-y-10">
        {edges.length ? (
          edges.map(edge => <ItemLegal key={edge.id} {...edge} />)
        ) : (
          <Card className="text-muted-foreground flex items-center justify-center p-6">
            {t('empty')}
          </Card>
        )}
      </div>
    </div>
  );
};
