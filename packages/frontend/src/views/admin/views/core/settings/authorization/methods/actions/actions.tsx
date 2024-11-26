import { ShowMethodAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

import { DeleteActionMethodsAuthSettingsAdmin } from './delete/delete';

export const ActionsContentMethodsAuthSettingsAdmin = (
  props: ShowMethodAuthSettingsAdminObj['edges'][0],
) => {
  return (
    <>
      <DeleteActionMethodsAuthSettingsAdmin {...props} />
    </>
  );
};
