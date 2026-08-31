import "@tanstack/react-start/server-only";

import type { adminModule } from "@/api/modules/admin/admin.module";
import type { AdminSearchUser } from "@/views/admin/layouts/search/search-users";

import { clientModule } from "@/lib/fetcher-client";
import { fetcherServer } from "@/tanstack/fetcher/server";
import { MAX_SEARCH_RESULTS } from "@/views/admin/layouts/search/constants";

/**
 * The admin module, as a type-only reference.
 *
 * The same stub `./server` uses, and for the same reason: importing the real
 * module would pull the whole Hono admin API - its routes, its models, its
 * database access - into whatever bundles this. `clientModule` carries the one
 * field the fetcher reads at runtime while keeping the paths, methods and
 * response types fully checked.
 */
const admin = clientModule<typeof adminModule>("@vitnode/core");

/**
 * The AdminCP command palette's user lookup, server-side.
 *
 * The palette's second source. Its first - the navigation, flattened - needs no
 * server at all, because it is derived from configuration and a permission set
 * the browser already holds. Users are different: there are too many to ship, so
 * they are searched.
 *
 * ## An empty list rather than a rejection
 *
 * Every non-`200` answers `[]`, and that is deliberate here in a way it
 * emphatically is not for the admin *session*. A session that could not be read
 * must never be mistaken for "not an admin" - that is the bug
 * `readAdminSessionOnApi` exists to avoid. A user index that could not be
 * reached is a different question: the palette has already matched the pages,
 * and the honest degradation is to show those and no user results rather than to
 * replace the whole dialog with an error.
 *
 * ## The cookie is the authorization
 *
 * Nothing about who is asking is passed in. `fetcherServer` forwards the
 * request's own `Cookie` header, and the API authorizes the read against
 * `vitnode_auth_admin` in its own handler. The palette also checks
 * `users:can_view` before it ever calls this, but that check is a courtesy to
 * the reader and not a boundary: it decides whether to *ask*, never whether the
 * answer may be given.
 *
 * `MAX_SEARCH_RESULTS` is requested rather than more, because the dialog cannot
 * show more than that between pages and users combined - see
 * `splitResultBudget`.
 */
export const readAdminUserSearchOnApi = async (
  search: string,
): Promise<AdminSearchUser[]> => {
  try {
    const response = await fetcherServer(admin, {
      args: { query: { first: String(MAX_SEARCH_RESULTS), search } },
      method: "get",
      module: "admin/users",
      path: "/list",
      withPagination: true,
    });

    if (response.status !== 200) return [];

    const data = await response.json();

    return data.edges.map(user => ({
      avatarColor: user.avatarColor,
      email: user.email,
      id: user.id,
      name: user.name,
      nameCode: user.nameCode,
    }));
  } catch (error) {
    // The error is the fetcher's - an API URL and a server's error text - and
    // this value is serialized back to a browser. Logged here, where it belongs.
    // eslint-disable-next-line no-console
    console.error("[admin] the user search could not be read", error);

    return [];
  }
};
