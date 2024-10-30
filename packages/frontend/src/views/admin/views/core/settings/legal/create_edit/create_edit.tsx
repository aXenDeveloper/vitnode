import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader } from '@/components/ui/loader';
import { useTextLang } from '@/hooks/use-text-lang';
import { useTranslations } from 'next-intl';
import React from 'react';

const Content = React.lazy(async () =>
  import('./content').then(module => ({
    default: module.ContentCreateEditLegalPage,
  })),
);

export const CreateEditLegalPage = ({
  data,
}: React.ComponentProps<typeof Content>) => {
  const t = useTranslations('admin.core.settings.legal.create_edit');
  const { convertText } = useTextLang();

  return (
    <DialogContent className="max-w-6xl">
      <DialogHeader>
        <DialogTitle>{t(data ? 'edit' : 'create.title')}</DialogTitle>
        <DialogDescription>
          {data ? convertText(data.title) : t('create.desc')}
        </DialogDescription>
      </DialogHeader>

      <React.Suspense fallback={<Loader />}>
        <Content data={data} />
      </React.Suspense>
    </DialogContent>
  );
};
