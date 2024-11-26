import { AutoForm } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { AutoFormSelect } from '@/components/form/fields/select';
import { useTranslations } from 'next-intl';
import { ShowMethodAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

import { useCreateMethodAuthAdminApi } from './hooks/use-create-method-auth-admin-api';

export const ContentCreateMethodsAuthSettingsAdmin = ({
  enabledMethods,
  edges,
}: ShowMethodAuthSettingsAdminObj) => {
  const { formSchema, onSubmit } = useCreateMethodAuthAdminApi({
    edges,
    enabledMethods,
  });
  const t = useTranslations('admin.core.settings.authorization.methods.create');

  return (
    <AutoForm
      fields={[
        {
          id: 'provider',
          label: t('provider'),
          component: props => (
            <AutoFormSelect
              {...props}
              labels={Object.fromEntries(
                enabledMethods.map(method => [method.code, method.name]),
              )}
            />
          ),
        },
        {
          id: 'client_id',
          label: t('client_id'),
          component: AutoFormInput,
        },
        {
          id: 'client_secret',
          label: t('client_secret'),
          component: AutoFormInput,
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
    />
  );
};
