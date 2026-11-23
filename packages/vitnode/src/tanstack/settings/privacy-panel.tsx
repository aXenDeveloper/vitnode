import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import React from "react";

import type { UpdatePrivacy } from "@/views/auth/settings/privacy/privacy-update";

import { personalInfoPolicyQueryKey } from "@/views/auth/settings/overview/personal-update";
import { PrivacySettingsContent } from "@/views/auth/settings/privacy/privacy-content";
import {
  accountDeletionQueryKey,
  accountDeletionQueryOptions,
  cancelAccountDeletion,
  downloadPersonalData,
  requestAccountDeletion,
} from "@/views/auth/settings/privacy/privacy-query";
import { PrivacySettings } from "@/views/auth/settings/privacy/privacy-settings";
import { updatePrivacyInBrowser } from "@/views/auth/settings/privacy/privacy-update";
import { ReactionPrivacySetting } from "@/views/auth/settings/privacy/reaction-privacy-setting";
import { PRESENCE_QUERY_ROOT } from "@/views/presence/presence-query";

import { useSignOutAction } from "../auth/actions";
import { invalidateSession, sessionQueryOptions } from "../auth/session-query";
import { personalInfoPolicyQuery } from "./personal-policy";

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
  const { data: session } = useSuspenseQuery(sessionQueryOptions());
  const { data: policy } = useSuspenseQuery(personalInfoPolicyQuery());

  const onPrivacyUpdate: UpdatePrivacy = React.useCallback(
    async input => {
      const result = await updatePrivacyInBrowser(input);
      if (result.data) {
        await Promise.all([
          invalidateSession(queryClient),
          queryClient.invalidateQueries({ queryKey: PRESENCE_QUERY_ROOT }),
        ]);
      }
      if (result.error?.status === 403) {
        await queryClient.invalidateQueries({
          queryKey: personalInfoPolicyQueryKey(),
        });
      }

      return result;
    },
    [queryClient],
  );

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
      visibility={
        <>
          {session.user ? (
            <PrivacySettings
              hideOnlineStatus={session.user.hideOnlineStatus}
              onUpdate={onPrivacyUpdate}
              policy={policy.browseAnonymously}
            />
          ) : null}
          <ReactionPrivacySetting />
        </>
      }
    />
  );
};
