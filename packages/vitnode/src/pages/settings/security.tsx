import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { settingsBreadcrumb } from "@/tanstack/settings/breadcrumb";
import { SecuritySettings } from "@/views/auth/settings/security/security";

export const route = defineAuthenticatedRoute({
  head: ({ t }) => ({
    title: `${t("core.auth.settings.nav.security")} - ${t("core.auth.settings.title")}`,
  }),

  breadcrumb: settingsBreadcrumb("security"),
});

export default SecuritySettings;
