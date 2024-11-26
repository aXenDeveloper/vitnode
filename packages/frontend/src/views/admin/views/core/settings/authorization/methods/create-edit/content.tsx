import { AutoForm, DependencyType } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { AutoFormSelect } from '@/components/form/fields/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CONFIG } from '@/helpers/config-with-env';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ShowMethodAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

import { useCreateMethodAuthAdminApi } from './hooks/use-create-method-auth-admin-api';

export const ContentCreateEditMethodsAuthSettingsAdmin = ({
  dataFromSSR: { enabledMethods, edges },
  data,
}: {
  data?: ShowMethodAuthSettingsAdminObj['edges'][0];
  dataFromSSR: ShowMethodAuthSettingsAdminObj;
}) => {
  const t = useTranslations('admin.core.settings.authorization.methods.create');
  const { formSchema, onSubmit, values, setValues } =
    useCreateMethodAuthAdminApi({
      dataFromSSR: {
        enabledMethods,
        edges,
      },
      data,
    });

  return (
    <AutoForm
      dependencies={[
        {
          sourceField: 'provider',
          type: DependencyType.HIDES,
          targetField: 'provider',
          when: () => !!data,
        },
        {
          sourceField: 'provider',
          type: DependencyType.HIDES,
          targetField: 'client_id',
          when: (provider: string) => !provider,
        },
        {
          sourceField: 'provider',
          type: DependencyType.HIDES,
          targetField: 'client_secret',
          when: (provider: string) => !provider,
        },
      ]}
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
      onValuesChange={setValues}
    >
      {values.provider && (
        <Alert variant="primary">
          <AlertTitle>{t('your_callback_url')}</AlertTitle>
          <AlertDescription>
            {`${CONFIG.frontend_url}/login/sso/${values.provider}/callback`}
          </AlertDescription>
        </Alert>
      )}
    </AutoForm>
  );
};
