import { CreateActionPluginAdmin } from './create/create';
import { UploadActionPluginAdmin } from './upload/upload';

export const ActionsPluginsAdmin = () => {
  return (
    <>
      <CreateActionPluginAdmin />
      <UploadActionPluginAdmin />
    </>
  );
};
