import type { QueryClient } from "@tanstack/react-query";

import { ADMIN_SEARCH_USERS_QUERY_KEY } from "@/views/admin/layouts/search/search-users";
import { ADMIN_QUERY_ROOT } from "@/views/admin/table/query";

import { removeAdminSession } from "./state";

export const removeAdminShellQueries = (queryClient: QueryClient): void => {
  queryClient.removeQueries({ queryKey: ADMIN_SEARCH_USERS_QUERY_KEY });
  queryClient.removeQueries({ queryKey: ADMIN_QUERY_ROOT });
};

export const removeAdminIdentityQueries = (queryClient: QueryClient): void => {
  removeAdminSession(queryClient);
  removeAdminShellQueries(queryClient);
};
