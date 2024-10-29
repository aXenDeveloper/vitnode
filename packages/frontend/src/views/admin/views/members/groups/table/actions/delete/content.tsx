import { AutoForm } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import {
  AlertDialogCancel,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { GroupsMembersAdminObj } from 'vitnode-shared/admin/members/groups.dto';

import { useDeleteGroupAdmin } from './hooks/use-delete-group-admin';

export const ContentDeleteGroupsMembersDialogAdmin = ({
  id,
  name,
}: Pick<GroupsMembersAdminObj['edges'][0], 'id' | 'name'>) => {
  const t = useTranslations('admin.members.groups.delete');
  const tCore = useTranslations('core.global');
  const { onSubmit, formSchema } = useDeleteGroupAdmin({ name, id });

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
          <Button {...props} variant="destructive">
            {t('submit')}
          </Button>
        </AlertDialogFooter>
      )}
    />
  );
};
