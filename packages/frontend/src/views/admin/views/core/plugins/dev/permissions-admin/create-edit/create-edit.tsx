import { AutoForm } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { AutoFormSelect } from '@/components/form/fields/select';
import { useTranslations } from 'next-intl';

import { PermissionsAdminWithI18n } from '../permissions-admin';
import { useCreateEditPermissionAdminPluginAdmin } from './hooks/use-create-edit-permission-admin-plugin-admin';

export const CreateEditPermissionsAdminDevPluginAdmin = ({
  dataWithI18n,
  data,
  parentId,
}: {
  data?: PermissionsAdminWithI18n;
  dataWithI18n: PermissionsAdminWithI18n[];
  parentId?: string;
}) => {
  const t = useTranslations(
    'admin.core.plugins.dev.permissions-admin.create_edit',
  );
  const { formSchema, onSubmit } = useCreateEditPermissionAdminPluginAdmin({
    dataWithI18n,
    data,
    parentId,
  });

  return (
    <AutoForm
      fields={[
        {
          id: 'id',
          component: AutoFormInput,
          label: t('id.label'),
          description: t('id.desc'),
        },
        {
          id: 'parent_id',
          label: t('parent.label'),
          component: props => (
            <AutoFormSelect
              {...props}
              labels={{
                null: t('parent.null'),
              }}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
    />
  );
};
