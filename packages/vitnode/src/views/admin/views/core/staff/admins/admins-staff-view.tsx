import { StaffTableAdmin } from "../staff-table";

export const AdminsStaffAdminView = (
  props: Pick<React.ComponentProps<typeof StaffTableAdmin>, "searchParams">,
) => {
  return <StaffTableAdmin type="admins" {...props} />;
};
