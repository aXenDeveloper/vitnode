import { ShowMethodAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';
import React from 'react';
import { Switch } from '@/components/ui/switch';

export const EnabledContentMethodsAuthSettingsAdmin = ({
  enabled,
  code,
}: ShowMethodAuthSettingsAdminObj['edges'][0]) => {
  const [checked, changeChecked] = React.useOptimistic(enabled);

  return (
    <Switch
      checked={checked}
      disabled={code === 'standard'}
      onClick={() => {
        changeChecked(!checked);

        // try {
        //   await editMutationApi({
        //     ...data,
        //     enabled: !data.enabled,
        //     time_24: data.time_24,
        //     allow_in_input: data.allow_in_input,
        //   });
        // } catch (_) {
        //   toast.error(t('title'), {
        //     description: t('internal_server_error'),
        //   });
        //   changeChecked(!checked);
        // }
      }}
    />
  );
};
