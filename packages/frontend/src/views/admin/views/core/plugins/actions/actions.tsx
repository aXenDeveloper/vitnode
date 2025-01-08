import { UserWithDangerousInfo } from 'vitnode-shared/user.dto';

import { CreateActionPluginAdmin } from './create/create';
import { UploadActionPluginAdmin } from './upload/upload';

export const ActionsPluginsAdmin = ({
  user,
}: {
  user: UserWithDangerousInfo;
}) => {
  return (
    <>
      <CreateActionPluginAdmin user={user} />
      <UploadActionPluginAdmin />
    </>
  );
};
