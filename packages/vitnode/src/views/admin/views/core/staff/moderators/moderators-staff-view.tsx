import { StaffTableAdmin } from "../staff-table";

export const ModeratorsStaffAdminView = (
  props: Pick<React.ComponentProps<typeof StaffTableAdmin>, "searchParams">,
) => {
  return <StaffTableAdmin type="moderators" {...props} />;
};
