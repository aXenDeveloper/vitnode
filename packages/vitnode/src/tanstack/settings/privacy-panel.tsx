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

/** `/settings/privacy`: the data export and account deletion, wired to the API. */
export const PrivacyPanelContent = ({ userId }: { userId: number }) => {
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
      onDownload={downloadPersonalData}
      onRequestDeletion={async values => {
        const result = await requestAccountDeletion(values);
        if (result.ok) {
          // The API already ended every session; this clears the cookie and
          // the cached identity in this tab.
          await signOut();
          await navigate({ to: "/" });
        }

        return result;
      }}
      status={data}
    />
  );
};
