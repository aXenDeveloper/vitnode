import { notFound } from "next/navigation";

import { I18nProvider } from "@/components/i18n-provider";
import { getSessionApi } from "@/lib/api/get-session-api";

import { SettingsShell } from "./shell";

export const LayoutSettings = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const session = await getSessionApi();

  if (!session.user) {
    notFound();
  }

  return (
    <I18nProvider namespaces="core.auth.settings">
      <SettingsShell>{children}</SettingsShell>
    </I18nProvider>
  );
};
