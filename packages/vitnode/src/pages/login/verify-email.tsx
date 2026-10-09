import type { PluginRoutePageProps } from "@/routing";
import type { VerifyEmailSearch } from "@/tanstack/auth/verify-email";

import { PasswordRecoveryNotFound } from "@/tanstack/auth/recovery-screen";
import { loadVerifyEmailRoute } from "@/tanstack/auth/verify-email-route";
import {
  VerifyEmailBreadcrumb,
  VerifyEmailRouteContent,
} from "@/tanstack/auth/verify-email-screen";
import { ErrorActions } from "@/tanstack/layout/error-actions";
import { defineRoute } from "@/tanstack/plugin-routes";

const VerifyEmailPage = ({
  search,
}: PluginRoutePageProps<undefined, VerifyEmailSearch>) => (
  <VerifyEmailRouteContent search={search} />
);

export const route = defineRoute<undefined, VerifyEmailSearch>({
  load: async ({ context }) => {
    await loadVerifyEmailRoute(context);
  },
  head: ({ t }) => ({
    robots: "noindex, nofollow",
    title: t("core.auth.verify_email.title"),
  }),

  breadcrumb: VerifyEmailBreadcrumb,

  notFound: function EmailVerificationNotFoundScreen() {
    return <PasswordRecoveryNotFound actions={<ErrorActions />} />;
  },
});

export default VerifyEmailPage;
