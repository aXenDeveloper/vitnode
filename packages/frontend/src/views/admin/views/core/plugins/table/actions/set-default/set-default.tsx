import { ShowPluginAdmin } from 'vitnode-shared/admin/plugins.dto';

import { ButtonSetDefaultPluginActionsAdmin } from './button';
import { useSetDefaultPluginAdmin } from './hooks/use-set-default-admin';

export const SetDefaultPluginActionsAdmin = (props: ShowPluginAdmin) => {
  const { onSubmit } = useSetDefaultPluginAdmin(props);

  return (
    <form action={onSubmit}>
      <ButtonSetDefaultPluginActionsAdmin />
    </form>
  );
};
