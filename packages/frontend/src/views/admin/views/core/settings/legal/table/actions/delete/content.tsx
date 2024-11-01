import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  useAlertDialog,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useTextLang } from '@/hooks/use-text-lang';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { LegalsObj } from 'vitnode-shared/legal.dto';

import { mutationApi } from './mutation-api';
import { SubmitDeleteContentLegalSettingsAdmin } from './submit';

export const ContentDeleteContentLegalSettingsAdmin = ({
  code,
  title,
}: Pick<LegalsObj['edges'][0], 'code' | 'title'>) => {
  const t = useTranslations('admin.core.settings.legal.delete');
  const tCore = useTranslations('core.global');
  const { setOpen } = useAlertDialog();
  const { convertText } = useTextLang();
  const convertedTitle = convertText(title);

  const onSubmit = async () => {
    try {
      await mutationApi(code);
      setOpen(false);
      toast.success(t('success'), {
        description: convertedTitle,
      });
    } catch (_) {
      toast.error(tCore('errors.title'), {
        description: tCore('errors.internal_server_error'),
      });
    }
  };

  return (
    <AlertDialogContent>
      <AlertDialogTitle>{tCore('are_you_sure')}</AlertDialogTitle>
      <AlertDialogDescription>
        {t.rich('desc', {
          name: () => (
            <span className="text-foreground font-semibold">
              {convertedTitle}
            </span>
          ),
        })}
      </AlertDialogDescription>

      <form action={onSubmit}>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline">{tCore('cancel')}</Button>
          </AlertDialogCancel>

          <SubmitDeleteContentLegalSettingsAdmin />
        </AlertDialogFooter>
      </form>
    </AlertDialogContent>
  );
};
