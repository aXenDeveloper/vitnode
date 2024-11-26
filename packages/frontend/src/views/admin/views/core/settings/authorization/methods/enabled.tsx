import { Switch } from '@/components/ui/switch';
import { useTranslations } from 'next-intl';
import React from 'react';
import { toast } from 'sonner';
import { ShowMethodAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

import { editMutationApi } from './create-edit/hooks/edit-mutation-api';

export const EnabledContentMethodsAuthSettingsAdmin = (
  data: ShowMethodAuthSettingsAdminObj['edges'][0],
) => {
  const [checked, changeChecked] = React.useOptimistic(data.enabled);
  const t = useTranslations('core.global.errors');

  return (
    <Switch
      checked={checked}
      disabled={data.code === 'standard'}
      onClick={async () => {
        React.startTransition(() => {
          changeChecked(!checked);
        });

        try {
          await editMutationApi({
            ...data,
            enabled: !data.enabled,
          });
        } catch (_) {
          toast.error(t('title'), {
            description: t('internal_server_error'),
          });
          React.startTransition(() => {
            changeChecked(!checked);
          });
        }
      }}
    />
  );
};
