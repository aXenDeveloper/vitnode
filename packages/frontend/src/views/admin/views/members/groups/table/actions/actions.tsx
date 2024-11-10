import { GroupsMembersAdminObj } from 'vitnode-shared/admin/members/groups.dto';

import { DeleteGroupsMembersDialogAdmin } from './delete/delete';
import { EditGroupsMembersDialogAdmin } from './edit';

export const ActionsTableGroupsMembersAdmin = (
  props: GroupsMembersAdminObj['edges'][0],
) => {
  return (
    <>
      <EditGroupsMembersDialogAdmin {...props} />
      {!props.protected && <DeleteGroupsMembersDialogAdmin {...props} />}
    </>
  );
};
