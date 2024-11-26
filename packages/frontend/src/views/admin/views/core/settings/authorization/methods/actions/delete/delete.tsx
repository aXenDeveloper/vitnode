import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  useAlertDialog,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { TooltipWrapper } from '@/components/ui/tooltip';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ShowMethodAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

import { mutationApi } from './hooks/mutation-api';
import { SubmitDeleteActionMethodsAuthSettingsAdmin } from './submit';

export const DeleteActionMethodsAuthSettingsAdmin = ({
  code,
  name,
}: ShowMethodAuthSettingsAdminObj['edges'][0]) => {
  const t = useTranslations('admin.core.settings.authorization.methods.delete');
  const tCore = useTranslations('core.global');
  const { setOpen } = useAlertDialog();

  const onSubmit = async () => {
    try {
      await mutationApi(code);

      setOpen(false);
      toast.success(t('success'), {
        description: name,
      });
    } catch (_) {
      toast.error(tCore('errors.title'), {
        description: tCore('errors.internal_server_error'),
      });
    }
  };

  return (
    <AlertDialog>
      <TooltipWrapper content={tCore('delete')}>
        <AlertDialogTrigger asChild>
          <Button
            ariaLabel={tCore('delete')}
            disabled={code === 'standard'}
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
          <AlertDialogDescription>
            {t.rich('desc', {
              name: () => (
                <span className="text-foreground font-semibold">{name}</span>
              ),
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Alert variant="warn">
          <AlertDescription>{t('warn')}</AlertDescription>
        </Alert>

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline">
              {tCore('cancel')}
            </Button>
          </AlertDialogCancel>

          <form action={onSubmit}>
            <SubmitDeleteActionMethodsAuthSettingsAdmin />
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
