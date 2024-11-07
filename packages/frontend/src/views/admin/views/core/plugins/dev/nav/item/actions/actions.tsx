import { ParentNavAuthAdminObj } from 'vitnode-shared/admin/auth.dto';

import { ItemContentNavDevPluginAdmin } from '../item';
import { DeleteActionTableNavDevPluginAdmin } from './delete/delete';
import { EditActionTableNavDevPluginAdmin } from './edit';

export const ActionsTableNavDevPluginAdmin = ({
  data,
  parentId,
  textsAndIcons,
  dataFromSSR,
}: {
  dataFromSSR: ParentNavAuthAdminObj[];
} & React.ComponentProps<typeof ItemContentNavDevPluginAdmin>) => {
  return (
    <div className="flex gap-1">
      <EditActionTableNavDevPluginAdmin
        data={data}
        dataFromSSR={dataFromSSR}
        textsAndIcons={textsAndIcons}
      />
      <DeleteActionTableNavDevPluginAdmin {...data} parentId={parentId} />
    </div>
  );
};
