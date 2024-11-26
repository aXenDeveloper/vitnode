import { ShowMethodAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

import { DeleteActionMethodsAuthSettingsAdmin } from './delete/delete';
import { EditActionMethodsAuthSettingsAdmin } from './edit';

export const ActionsContentMethodsAuthSettingsAdmin = ({
  data,
  dataFromSSR,
}: {
  data: ShowMethodAuthSettingsAdminObj['edges'][0];
  dataFromSSR: ShowMethodAuthSettingsAdminObj;
}) => {
  if (data.code === 'standard') return null;

  return (
    <>
      <EditActionMethodsAuthSettingsAdmin
        data={data}
        dataFromSSR={dataFromSSR}
      />
      <DeleteActionMethodsAuthSettingsAdmin {...data} />
    </>
  );
};
