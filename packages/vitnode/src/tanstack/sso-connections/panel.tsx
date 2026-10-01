import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { useTranslations } from "use-intl";

import { PageTitle } from "@/components/ui/page-title";
import { ImportPreviewDialog } from "@/views/auth/settings/sso/import-preview-dialog";
import {
  SsoConnectionsContent,
  SsoConnectionsSkeleton,
} from "@/views/auth/settings/sso/sso-connections-content";
import {
  ssoConnectionsQueryOptions,
  ssoImportPreviewQueryOptions,
} from "@/views/auth/settings/sso/sso-connections-query";

import type { SsoSettingsSearch } from "./route-search";

import { sessionQueryOptions } from "../auth/session-query";
import { useSsoConnectionActions } from "./query";

const SsoConnectionsHeading = () => {
  const t = useTranslations("core.auth.settings.nav");
  const tSettings = useTranslations("core.auth.settings");

  return (
    <PageTitle
      className="mb-0"
      desc={tSettings("sso.desc")}
      h1={t("sso")}
      subtitle={tSettings("title")}
    />
  );
};

export const SsoConnectionsPanelPending = () => (
  <>
    <SsoConnectionsHeading />
    <SsoConnectionsSkeleton />
  </>
);

export const SsoConnectionsPanelContent = ({
  nameCode,
  navigate,
  search,
  userId,
}: {
  nameCode: string;
  navigate: (options: { search: SsoSettingsSearch }) => Promise<void>;
  search: SsoSettingsSearch;
  userId: number;
}) => {
  const { data } = useSuspenseQuery(ssoConnectionsQueryOptions({ userId }));
  const { data: session } = useSuspenseQuery(sessionQueryOptions());
  const actions = useSsoConnectionActions({ nameCode, userId });
  const profile = {
    avatarUrl: session.user?.avatarUrl ?? null,
    firstName: session.user?.firstName ?? null,
    lastName: session.user?.lastName ?? null,
  };
  const importProviderId = search.import;
  const preview = useQuery({
    ...ssoImportPreviewQueryOptions({
      providerId: importProviderId ?? "",
      userId,
    }),
    enabled: !!importProviderId,
  });

  const closeImport = React.useCallback(() => {
    if (importProviderId) {
      void actions.onDiscardImport({ providerId: importProviderId });
    }
    void navigate({ search: {} });
  }, [actions, importProviderId, navigate]);

  return (
    <>
      <SsoConnectionsHeading />
      <SsoConnectionsContent
        data={data}
        onDisconnect={actions.onDisconnect}
        onSavePreferences={actions.onSavePreferences}
        onStart={actions.onStart}
        profile={profile}
      />
      {importProviderId ? (
        <ImportPreviewDialog
          currentAvatarUrl={profile.avatarUrl}
          onApply={actions.onApplyImport}
          onClose={closeImport}
          preview={preview.isPending ? undefined : (preview.data ?? null)}
          providerId={importProviderId}
          providers={data.providers}
        />
      ) : null}
    </>
  );
};
