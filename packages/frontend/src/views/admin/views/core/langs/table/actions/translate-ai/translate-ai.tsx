import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader } from '@/components/ui/loader';
import { TooltipWrapper } from '@/components/ui/tooltip';
import { SparklesIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

const Content = React.lazy(async () =>
  import('./content').then(module => ({
    default: module.ContentTranslateAiActionTableLangsCoreAdmin,
  })),
);

export const TranslateAiActionTableLangsCoreAdmin = (
  props: React.ComponentProps<typeof Content>,
) => {
  const t = useTranslations('admin.core.langs.actions.translate-ai');

  return (
    <Dialog>
      <TooltipWrapper content={t('title')}>
        <DialogTrigger asChild>
          <Button ariaLabel={t('title')} size="icon" variant="ghost">
            <SparklesIcon />
          </Button>
        </DialogTrigger>
      </TooltipWrapper>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t.rich('desc', {
              lang: () => (
                <span className="text-foreground font-semibold">
                  {props.name}
                </span>
              ),
            })}
          </DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <Content {...props} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
