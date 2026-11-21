import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { PrivacySettingsContent } from "@/views/auth/settings/privacy/privacy-content";
import {
  accountDeletionQueryKey,
  accountDeletionQueryOptions,
  cancelAccountDeletion,
  downloadPersonalData,
  requestAccountDeletion,
} from "@/views/auth/settings/privacy/privacy-query";

import { useSignOutAction } from "../auth/actions";

export const PrivacyPanelContent = ({
  userId,
  userName,
}: {
  userId: number;
  userName: string;
}) => {
  const { data } = useSuspenseQuery(accountDeletionQueryOptions({ userId }));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const signOut = useSignOutAction();

  return (
    <PrivacySettingsContent
      onCancelDeletion={async () => {
        const ok = await cancelAccountDeletion();
        if (ok) {
          await queryClient.invalidateQueries({
            queryKey: accountDeletionQueryKey(userId),
          });
        }

        return ok;
      }}
      onDeletionScheduled={async () => {
        await signOut();
        await navigate({ to: "/" });
      }}
      onDownload={downloadPersonalData}
      onRequestDeletion={requestAccountDeletion}
      status={data}
      userName={userName}
    />
  );
};
