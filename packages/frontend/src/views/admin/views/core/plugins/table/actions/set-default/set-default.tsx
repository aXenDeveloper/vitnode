import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { useTranslations } from 'next-intl';
import { ShowPluginAdmin } from 'vitnode-shared/admin/plugins.dto';

import { ButtonSetDefaultPluginActionsAdmin } from './button';
import { useSetDefaultPluginAdmin } from './hooks/use-set-default-admin';

export const SetDefaultPluginActionsAdmin = (props: ShowPluginAdmin) => {
  const t = useTranslations('admin.core.plugins');
  const { onSubmit } = useSetDefaultPluginAdmin(props);

  return (
    <form action={onSubmit}>
      <TooltipProvider>
        <Tooltip>
          <ButtonSetDefaultPluginActionsAdmin />
          <TooltipContent>{t('set_default')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </form>
  );
};
