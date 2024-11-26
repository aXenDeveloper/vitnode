import { Switch } from '@/components/ui/switch';
import { useLocale, useTranslations } from 'next-intl';
import React from 'react';
import { toast } from 'sonner';
import { LanguagesAdminObj } from 'vitnode-shared/admin/language.dto';

import { editMutationApi } from '../create-edit/hooks/edit-mutation-api';

export const EnabledRowTableLangsCoreAdmin = ({
  data,
}: {
  data: LanguagesAdminObj;
}) => {
  const locale = useLocale();
  const t = useTranslations('core.global.errors');
  const [checked, changeChecked] = React.useOptimistic(data.enabled);

  return (
    <Switch
      checked={checked}
      disabled={data.default || data.code === locale}
      onClick={async () => {
        React.startTransition(() => {
          changeChecked(!checked);
        });

        try {
          await editMutationApi({
            ...data,
            enabled: !data.enabled,
            time_24: data.time_24,
            allow_in_input: data.allow_in_input,
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
