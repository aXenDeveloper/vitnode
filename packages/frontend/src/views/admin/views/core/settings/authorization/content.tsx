'use client';

import { AutoForm } from '@/components/form/auto-form';
import { AutoFormSwitch } from '@/components/form/fields/switch';
import { Alert } from '@/components/ui/alert';
import { useTranslations } from 'next-intl';
import { ShowAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

import { useAuthorizationFormAdmin } from './hooks/use-authorization-settings-form-admin';

export const ContentAuthorizationSettingsAdminView = ({
  isEmailEnabled,
  ...props
}: {
  isEmailEnabled: boolean;
} & ShowAuthSettingsAdminObj) => {
  const t = useTranslations('admin.core.settings.authorization.settings');
  const tAdminGlobal = useTranslations('admin.global');
  const { onSubmit, formSchema } = useAuthorizationFormAdmin(props);

  return (
    <AutoForm
      fields={[
        {
          id: 'force_login',
          component: AutoFormSwitch,
          hideOptionalLabel: true,
          label: t('force_login.title'),
          description: t('force_login.desc'),
        },
        {
          id: 'lock_register',
          component: AutoFormSwitch,
          hideOptionalLabel: true,
          label: t('lock_register.title'),
          description: t('lock_register.desc'),
        },
        {
          id: 'require_confirm_email',
          component: props => (
            <AutoFormSwitch {...props} disabled={!isEmailEnabled} />
          ),
          hideOptionalLabel: true,
          label: t('require_confirm_email.title'),
          description: (
            <>
              {t('require_confirm_email.desc')}
              {!isEmailEnabled && (
                <Alert className="mt-2 w-fit" variant="warn">
                  {tAdminGlobal('require_email_service')}
                </Alert>
              )}
            </>
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      theme="horizontal"
    />
  );
};
