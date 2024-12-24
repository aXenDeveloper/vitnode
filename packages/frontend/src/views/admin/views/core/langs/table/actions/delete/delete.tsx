import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { TooltipWrapper } from '@/components/ui/tooltip';
import { Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import React from 'react';

const Content = React.lazy(async () =>
  import('./content').then(module => ({
    default: module.ContentDeleteActionsTableLangsCoreAdmin,
  })),
);

export const DeleteActionsTableLangsCoreAdmin = (
  props: React.ComponentProps<typeof Content>,
) => {
  const t = useTranslations('admin.core.langs.actions.delete');
  const tCore = useTranslations('core.global');
  const locale = useLocale();

  return (
    <AlertDialog>
      <TooltipWrapper content={tCore('delete')}>
        <AlertDialogTrigger asChild>
          <Button
            ariaLabel={tCore('delete')}
            disabled={locale === props.code}
            size="icon"
            variant="destructiveGhost"
          >
            <Trash2 />
          </Button>
        </AlertDialogTrigger>
      </TooltipWrapper>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {tCore('are_you_absolutely_sure')}
          </AlertDialogTitle>
          <AlertDialogDescription className="flex flex-col gap-4">
            <span>{t('text')}</span>
            <span>
              {t.rich('form_confirm_text', {
                text: () => (
                  <span className="text-foreground font-semibold">
                    {props.name}
                  </span>
                ),
              })}
            </span>
          </AlertDialogDescription>

          <React.Suspense fallback={<Loader />}>
            <Content {...props} />
          </React.Suspense>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>
  );
};
