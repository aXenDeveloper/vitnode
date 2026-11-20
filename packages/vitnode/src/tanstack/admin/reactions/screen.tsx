import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { ReactionDialogState } from "@/views/admin/views/core/reactions/reactions-content";

import {
  AdminStaffPermissionGate,
  useAdminStaffPermission,
} from "@/components/staff-permission/provider";
import { PageTitle } from "@/components/ui/page-title";
import {
  CreateReactionButton,
  ReactionsContent,
  RecountReputationButton,
} from "@/views/admin/views/core/reactions/reactions-content";
import {
  createAdminReaction,
  deleteAdminReaction,
  recountAdminReputation,
  reorderAdminReactions,
  updateAdminReaction,
} from "@/views/admin/views/core/reactions/reactions-mutations";
import {
  adminReactionsQueryOptions,
  adminReactionsQueryRoot,
} from "@/views/admin/views/core/reactions/reactions-query";
import { isAdminMutationError } from "@/views/admin/views/core/shared/admin-mutation";
import { ADMIN_REACTION_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminReactionsRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { REACTIONS_QUERY_ROOT } from "../../reactions/query";
import { useAdminIdentity } from "../identity";
import { ADMIN_REACTIONS_NAMESPACES } from "./route";

const ReactionsScreen = ({ description, title }: AdminReactionsRouteData) => {
  const t = useTranslations("admin.reactions");
  const adminUserId = useAdminIdentity();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(adminReactionsQueryOptions(adminUserId));
  const canManage = useAdminStaffPermission(ADMIN_REACTION_PERMISSIONS.manage);
  const [dialog, setDialog] = React.useState<ReactionDialogState>({
    mode: "create",
  });
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: adminReactionsQueryRoot(adminUserId),
      }),
      queryClient.invalidateQueries({ queryKey: REACTIONS_QUERY_ROOT }),
    ]);
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageTitle desc={description} h1={title}>
        <AdminStaffPermissionGate {...ADMIN_REACTION_PERMISSIONS.manage}>
          <div className="flex flex-wrap gap-2">
            <RecountReputationButton onRecount={recountAdminReputation} />
            <CreateReactionButton
              count={data.length}
              onCreate={() => {
                setDialog({ mode: "create" });
                setDialogOpen(true);
              }}
            />
          </div>
        </AdminStaffPermissionGate>
      </PageTitle>

      <ReactionsContent
        dialog={dialog}
        dialogOpen={dialogOpen}
        onDelete={async id => {
          const result = await deleteAdminReaction(id);
          if (!isAdminMutationError(result)) await refresh();

          return result;
        }}
        onDialogOpenChange={setDialogOpen}
        onOpenDialog={state => {
          setDialog(state);
          setDialogOpen(true);
        }}
        onReorder={async ids => {
          const result = await reorderAdminReactions(ids);
          if (isAdminMutationError(result)) {
            throw new Error(
              `Saving the order answered ${result.error.status}.`,
            );
          }
          await refresh();
          toast.success(t("reorder.success"), {
            description: t("reorder.success_desc"),
          });
        }}
        onSave={async ({ id, values }) => {
          const result =
            id === undefined
              ? await createAdminReaction(values)
              : await updateAdminReaction(id, values);
          if (!isAdminMutationError(result)) await refresh();

          return result;
        }}
        permissions={{ canManage }}
        reactions={data}
      />
    </div>
  );
};

export const AdminReactionsRouteContent = (props: AdminReactionsRouteData) => (
  <RouteMessages namespaces={ADMIN_REACTIONS_NAMESPACES}>
    <ReactionsScreen {...props} />
  </RouteMessages>
);
