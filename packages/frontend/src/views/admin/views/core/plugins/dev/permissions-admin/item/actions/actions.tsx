import React from 'react';

import { DeleteActionItemPermissionsAdminDevPluginAdmin } from './delete/delete';
import { EditActionItemPermissionsAdminDevPluginAdmin } from './edit';

export const ActionsItemPermissionsAdminDevPluginAdmin = (
  props: React.ComponentProps<
    typeof EditActionItemPermissionsAdminDevPluginAdmin
  >,
) => {
  return (
    <>
      <EditActionItemPermissionsAdminDevPluginAdmin {...props} />
      <DeleteActionItemPermissionsAdminDevPluginAdmin
        {...props.data}
        parentId={props.parentId}
      />
    </>
  );
};
