import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useTextLang } from '@/hooks/use-text-lang';
import { Trash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ShowNavStyles } from 'vitnode-shared/nav.dto';

import { useDeleteNavAdmin } from './hooks/use-delete-nav-admin';
import { SubmitDeleteActionTableNavAdmin } from './submit';

export const ContentDeleteActionTableNavAdmin = ({
  children,
  id,
  name,
}: Pick<ShowNavStyles, 'children' | 'id' | 'name'>) => {
  const t = useTranslations('admin.core.styles.nav.delete');
  const tCore = useTranslations('core.global');
  const { onSubmit } = useDeleteNavAdmin({ id, name });
  const { convertText } = useTextLang();

  return (
    <form action={onSubmit}>
      <AlertDialogHeader>
        <AlertDialogTitle>{tCore('are_you_sure')}</AlertDialogTitle>
        <AlertDialogDescription>
          {t.rich('desc', {
            name: () => (
              <span className="text-foreground font-bold">
                {convertText(name)}
              </span>
            ),
          })}
        </AlertDialogDescription>

        {children.length > 0 && (
          <Alert variant="warn">
            <Trash className="size-4" />
            <AlertTitle>{tCore('are_you_sure')}</AlertTitle>
            <AlertDescription>{t('desc_with_children')}</AlertDescription>
          </Alert>
        )}
      </AlertDialogHeader>

      <AlertDialogFooter className="mt-6">
        <AlertDialogCancel asChild>
          <Button type="button" variant="outline">
            {tCore('cancel')}
          </Button>
        </AlertDialogCancel>
        <SubmitDeleteActionTableNavAdmin />
      </AlertDialogFooter>
    </form>
  );
};
