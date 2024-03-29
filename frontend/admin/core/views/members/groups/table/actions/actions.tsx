import type { ShowAdminGroups } from "@/graphql/hooks";
import { EditGroupsMembersDialogAdmin } from "./edit";
import { DeleteGroupsMembersDialogAdmin } from "./delete/delete";

export const ActionsTableGroupsMembersAdmin = (
  props: Omit<ShowAdminGroups, "default" | "root">
) => {
  return (
    <>
      <EditGroupsMembersDialogAdmin data={props} />
      {!props.protected && <DeleteGroupsMembersDialogAdmin {...props} />}
    </>
  );
};
