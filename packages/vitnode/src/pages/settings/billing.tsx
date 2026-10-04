import type { PluginRoutePageProps } from "@/routing";

import { loadBillingRoute } from "@/tanstack/payments/billing-route";
import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { settingsBreadcrumb } from "@/tanstack/settings/breadcrumb";
import { BillingContent } from "@/views/payments/billing/billing-content";

interface BillingData {
  userId: number;
}

const BillingPage = ({ loaderData }: PluginRoutePageProps<BillingData>) => (
  <BillingContent userId={loaderData.userId} />
);

export const route = defineAuthenticatedRoute<BillingData>({
  load: async ({ context }) =>
    await loadBillingRoute({
      queryClient: context.queryClient,
      userId: context.auth.user.id,
    }),
  head: ({ t }) => ({
    title: `${t("core.auth.settings.nav.billing")} - ${t("core.auth.settings.title")}`,
  }),

  breadcrumb: settingsBreadcrumb("billing"),
});

export default BillingPage;
