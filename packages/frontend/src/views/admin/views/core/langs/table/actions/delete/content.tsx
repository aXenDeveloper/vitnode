import { AutoForm } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import {
  AlertDialogCancel,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { LanguagesAdminObj } from 'vitnode-shared/admin/language.dto';

import { useDeleteLangAdmin } from './hooks/use-delete-lang-admin';

export const ContentDeleteActionsTableLangsCoreAdmin = (
  props: Pick<LanguagesAdminObj, 'code' | 'id' | 'name'>,
) => {
  const t = useTranslations('admin.core.langs.actions.delete');
  const tCore = useTranslations('core.global');
  const { onSubmit, formSchema } = useDeleteLangAdmin(props);

  return (
    <AutoForm
      fields={[
        {
          id: 'name',
          component: AutoFormInput,
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButton={props => (
        <AlertDialogFooter className="mt-6">
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline">
              {tCore('cancel')}
            </Button>
          </AlertDialogCancel>

          <Button variant="destructive" {...props}>
            {t('submit')}
          </Button>
        </AlertDialogFooter>
      )}
    />
  );
};
