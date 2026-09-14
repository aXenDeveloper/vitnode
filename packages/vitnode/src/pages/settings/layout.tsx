import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { settingsBreadcrumb } from "@/tanstack/settings/breadcrumb";
import { SettingsLayoutContent } from "@/tanstack/settings/layout";

const SettingsLayout = ({ children }: { children: React.ReactNode }) => (
  <SettingsLayoutContent>{children}</SettingsLayoutContent>
);

export const route = defineAuthenticatedRoute({
  head: () => ({ robots: "noindex, nofollow" }),

  /** The first crumb of the trail; each panel adds its own after it. */
  breadcrumb: settingsBreadcrumb(),
});

export default SettingsLayout;
