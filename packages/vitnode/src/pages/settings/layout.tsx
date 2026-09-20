import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { settingsBreadcrumb } from "@/tanstack/settings/breadcrumb";
import { SettingsLayoutContent } from "@/tanstack/settings/layout";
import { loadPageWidgets } from "@/tanstack/widgets";
import { settingsPage } from "@/views/auth/settings/widgets/settings-page";

const SettingsLayout = ({ children }: { children: React.ReactNode }) => (
  <SettingsLayoutContent>{children}</SettingsLayoutContent>
);

export const route = defineAuthenticatedRoute({
  load: async ({ context }) =>
    await loadPageWidgets(context.queryClient, settingsPage),
  head: () => ({ robots: "noindex, nofollow" }),

  /** The first crumb of the trail; each panel adds its own after it. */
  breadcrumb: settingsBreadcrumb(),
});

export default SettingsLayout;
