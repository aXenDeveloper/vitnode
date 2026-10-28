import type { AccountStatusRouteData } from "../tanstack/account-status/route";

import { loadAccountStatusRoute } from "../tanstack/account-status/route";
import {
  AccountStatusBreadcrumb,
  AccountStatusRouteContent,
} from "../tanstack/account-status/screen";
import { defineRoute } from "../tanstack/plugin-routes";

const AccountStatusPage = () => <AccountStatusRouteContent />;

// Open to every visitor on purpose: a suspended account is a guest to every
// other route, and this is where it learns why.
export const route = defineRoute<AccountStatusRouteData>({
  load: async ({ context, t }) =>
    await loadAccountStatusRoute({ ...context, t }),
  head: ({ loaderData }) => ({ robots: "noindex, nofollow", ...loaderData }),

  breadcrumb: AccountStatusBreadcrumb,
});

export default AccountStatusPage;
