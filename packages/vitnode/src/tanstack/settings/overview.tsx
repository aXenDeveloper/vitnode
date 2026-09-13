import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import React from "react";

import type { UpdatePersonalInformation } from "@/views/auth/settings/overview/personal-update";

import { OverviewSettingsContent } from "@/views/auth/settings/overview/overview";
import { updatePersonalInformationInBrowser } from "@/views/auth/settings/overview/personal-update";
import { userProfileQueryKey } from "@/views/profile/profile-query";

import { invalidateSession, sessionQueryOptions } from "../auth/session-query";
import { useOwnUserImageEditor } from "../profile/own-image-editor";
import { userProfileQuery } from "../profile/query";
import { personalInfoPolicyQuery } from "./personal-policy";

export const OverviewSettings = ({ nameCode }: { nameCode: string }) => {
  const { data: profile } = useSuspenseQuery(userProfileQuery(nameCode));
  const { data: session } = useSuspenseQuery(sessionQueryOptions());
  const { data: policy } = useSuspenseQuery(personalInfoPolicyQuery());
  const queryClient = useQueryClient();
  const refresh = React.useCallback(
    async () =>
      await queryClient.invalidateQueries({
        queryKey: userProfileQueryKey(nameCode),
      }),
    [nameCode, queryClient],
  );
  const editor = useOwnUserImageEditor({ refresh });

  const onUpdate: UpdatePersonalInformation = React.useCallback(
    async input => {
      const result = await updatePersonalInformationInBrowser(input);

      if (result.data) await invalidateSession(queryClient);

      return result;
    },
    [queryClient],
  );

  if (!session.user) return null;

  return (
    <OverviewSettingsContent
      canEditPersonalInfo={policy.canEdit}
      editor={editor}
      onUpdate={onUpdate}
      personalFields={policy.fields}
      user={{
        ...profile,
        headline: session.user.headline,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        name: session.user.name,
        phone: session.user.phone,
        showRealName: session.user.showRealName,
      }}
    />
  );
};
