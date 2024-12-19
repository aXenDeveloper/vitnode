import { CONFIG } from '@/helpers/config-with-env';
import { CreateActionPluginAdmin } from './create/create';
import { UploadActionPluginAdmin } from './upload/upload';

export const ActionsPluginsAdmin = () => {
  return (
    <>
      <CreateActionPluginAdmin />
      {CONFIG.node_development && <UploadActionPluginAdmin />}
    </>
  );
};
