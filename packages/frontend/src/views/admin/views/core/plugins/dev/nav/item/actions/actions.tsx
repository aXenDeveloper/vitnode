import { ParentNavAuthAdminObj } from 'vitnode-shared/admin/auth.dto';

import { ItemContentNavDevPluginAdmin } from '../item';
import { DeleteActionTableNavDevPluginAdmin } from './delete/delete';
import { EditActionTableNavDevPluginAdmin } from './edit';

export const ActionsTableNavDevPluginAdmin = ({
  data,
  parentId,
  textsAndIcons,
  dataFromSSR,
}: React.ComponentProps<typeof ItemContentNavDevPluginAdmin> & {
  dataFromSSR: ParentNavAuthAdminObj[];
}) => {
  return (
    <>
      <EditActionTableNavDevPluginAdmin
        data={data}
        dataFromSSR={dataFromSSR}
        textsAndIcons={textsAndIcons}
      />
      <DeleteActionTableNavDevPluginAdmin {...data} parentId={parentId} />
    </>
  );
};
