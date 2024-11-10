import { AdminStaffMembersAdminObj } from 'vitnode-shared/admin/members/staff/admin.dto';

import { DeleteActionsTableAdministratorsStaffAdmin } from './delete/delete';
import { EditActionTableAdministratorsStaffAdmin } from './edit';

export const ActionsTableAdministratorsStaffAdmin = ({
  data,
  permissions,
}: {
  data: AdminStaffMembersAdminObj['edges'][0];
  permissions: AdminStaffMembersAdminObj['permissions'];
}) => {
  return (
    <>
      <EditActionTableAdministratorsStaffAdmin
        data={data}
        permissions={permissions}
      />
      <DeleteActionsTableAdministratorsStaffAdmin data={data} />
    </>
  );
};
