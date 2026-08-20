import { notFound } from "next/navigation";
import { Suspense } from "react";

import { I18nProvider } from "@/components/i18n-provider";
import { getSessionApi } from "@/lib/api/get-session-api";

import { SettingsPanelSkeleton } from "./panel-skeleton";
import { SettingsShell } from "./shell";

const RequireSession = async ({ children }: { children: React.ReactNode }) => {
  const session = await getSessionApi();

  if (!session.user) {
    notFound();
  }

  return children;
};

export const LayoutSettings = ({ children }: { children: React.ReactNode }) => {
  return (
    <I18nProvider namespaces="core.auth.settings">
      <SettingsShell>
        <Suspense fallback={<SettingsPanelSkeleton />}>
          <RequireSession>{children}</RequireSession>
        </Suspense>
      </SettingsShell>
    </I18nProvider>
  );
};
