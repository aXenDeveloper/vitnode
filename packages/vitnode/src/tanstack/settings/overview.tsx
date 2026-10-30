import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRightIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { UpdatePersonalInformation } from "@/views/auth/settings/overview/personal-update";
import type { UpdatePrivacy } from "@/views/auth/settings/overview/privacy-update";
import type { UpdateTimeZone } from "@/views/auth/settings/overview/time-zone-update";

import { Button } from "@/components/ui/button";
import {
  Frame,
  FrameAction,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame";
import {
  AiPointsBreakdown,
  AiUnlimitedPointsSummary,
} from "@/views/auth/settings/ai/ai-points-breakdown";
import { AiPointsContent } from "@/views/auth/settings/ai/ai-usage-content";
import {
  aiUsageQueryOptions,
  hasAiFeatures,
} from "@/views/auth/settings/ai/ai-usage-query";
import { OverviewSettingsContent } from "@/views/auth/settings/overview/overview";
import {
  personalInfoPolicyQueryKey,
  updatePersonalInformationInBrowser,
} from "@/views/auth/settings/overview/personal-update";
import { PrivacySettings } from "@/views/auth/settings/overview/privacy-settings";
import { updatePrivacyInBrowser } from "@/views/auth/settings/overview/privacy-update";
import { updateTimeZoneInBrowser } from "@/views/auth/settings/overview/time-zone-update";
import { SSO_CONNECTIONS_IDENTITY_ROOT } from "@/views/auth/settings/sso/sso-connections-query";
import { PRESENCE_QUERY_ROOT } from "@/views/presence/presence-query";
import { userProfileQueryKey } from "@/views/profile/profile-query";

import { useMiddlewareConfigQuery } from "../auth/middleware-config";
import { invalidateSession, sessionQueryOptions } from "../auth/session-query";
import { useOwnUserImageEditor } from "../profile/own-image-editor";
import { userProfileQuery } from "../profile/query";
import { personalInfoPolicyQuery } from "./personal-policy";

const OverviewAiPoints = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.auth.settings.ai.overview");
  const { data: config } = useMiddlewareConfigQuery();
  const { data: usage } = useQuery({
    ...aiUsageQueryOptions({ userId }),
    enabled: (config.ai?.models.length ?? 0) > 0,
  });

  if (!usage || !hasAiFeatures(usage)) return null;

  return (
    <Frame>
      <FrameHeader>
        <FrameTitle render={<h2 />}>{t("title")}</FrameTitle>
        <FrameAction>
          <Button
            nativeButton={false}
            render={<Link to="/settings/ai" />}
            size="sm"
            variant="outline"
          >
            {t("details")}
            <ArrowUpRightIcon className="rtl:-scale-x-100" />
          </Button>
        </FrameAction>
      </FrameHeader>
      <FramePanel render={<ul />}>
        {usage.points.total === null ? (
          <>
            <li className="flex items-start gap-3 p-4">
              <AiUnlimitedPointsSummary usage={usage} />
            </li>
            <li className="flex items-center gap-3 p-4">
              <AiPointsBreakdown actions={usage.actions} />
            </li>
          </>
        ) : (
          <li className="flex items-center gap-3 p-4">
            <AiPointsContent usage={usage} />
          </li>
        )}
      </FramePanel>
    </Frame>
  );
};

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

      if (result.data) {
        await Promise.all([
          invalidateSession(queryClient),
          queryClient.invalidateQueries({
            queryKey: SSO_CONNECTIONS_IDENTITY_ROOT,
          }),
          refresh(),
        ]);
      }

      return result;
    },
    [queryClient, refresh],
  );

  const onTimeZoneUpdate: UpdateTimeZone = React.useCallback(
    async timeZone => {
      const result = await updateTimeZoneInBrowser(timeZone);
      if (result.data) await invalidateSession(queryClient);

      return result;
    },
    [queryClient],
  );

  const onPrivacyUpdate: UpdatePrivacy = React.useCallback(
    async input => {
      const result = await updatePrivacyInBrowser(input);
      if (result.data) {
        await Promise.all([
          invalidateSession(queryClient),
          queryClient.invalidateQueries({ queryKey: PRESENCE_QUERY_ROOT }),
        ]);
      }
      // The roles took the choice away while this page was open.
      if (result.error?.status === 403) {
        await queryClient.invalidateQueries({
          queryKey: personalInfoPolicyQueryKey(),
        });
      }

      return result;
    },
    [queryClient],
  );

  if (!session.user) return null;

  return (
    <OverviewSettingsContent
      aiPoints={<OverviewAiPoints userId={session.user.id} />}
      canEditPersonalInfo={policy.canEdit}
      editor={editor}
      onTimeZoneUpdate={onTimeZoneUpdate}
      onUpdate={onUpdate}
      personalFields={policy.fields}
      privacy={
        <PrivacySettings
          hideOnlineStatus={session.user.hideOnlineStatus}
          onUpdate={onPrivacyUpdate}
          policy={policy.browseAnonymously}
        />
      }
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
        timeZone: session.user.timeZone,
      }}
    />
  );
};
