import { defineRoutes, index, layout, lazy, page } from "./routing";
import { contentListRouteSearch } from "./tanstack/admin/content/route-search";
import { ADMIN_CRON_NAMESPACES } from "./tanstack/admin/cron/route";
import { normalizeCronRouteSearch } from "./tanstack/admin/cron/route-search";
import { ADMIN_DEBUG_NAMESPACES } from "./tanstack/admin/debug/route";
import { normalizeDebugRouteSearch } from "./tanstack/admin/debug/route-search";
import { ADMIN_FILES_NAMESPACES } from "./tanstack/admin/files/route";
import { normalizeAdminFilesRouteSearch } from "./tanstack/admin/files/route-search";
import { ADMIN_INTEGRATIONS_NAMESPACES } from "./tanstack/admin/integrations/route";
import { ADMIN_NAVIGATION_NAMESPACES } from "./tanstack/admin/navigation/route";
import { ADMIN_QUEUE_NAMESPACES } from "./tanstack/admin/queue/route";
import { normalizeQueueRouteSearch } from "./tanstack/admin/queue/route-search";
import { ADMIN_ROLES_NAMESPACES } from "./tanstack/admin/roles/route";
import { normalizeRolesRouteSearch } from "./tanstack/admin/roles/route-search";
import { ADMIN_SEARCH_INDEX_NAMESPACES } from "./tanstack/admin/search-index/route";
import { normalizeSearchIndexRouteSearch } from "./tanstack/admin/search-index/route-search";
import { ADMIN_SIGN_IN_NAMESPACES } from "./tanstack/admin/sign-in-route";
import { normalizeAdminSignInSearch } from "./tanstack/admin/sign-in-search";
import { ADMIN_STAFF_CREATE_NAMESPACES } from "./tanstack/admin/staff/create-route";
import { ADMIN_STAFF_EDIT_NAMESPACES } from "./tanstack/admin/staff/edit-route";
import { ADMIN_STAFF_NAMESPACES } from "./tanstack/admin/staff/route";
import { normalizeStaffRouteSearch } from "./tanstack/admin/staff/route-search";
import { ADMIN_USER_NAMESPACES } from "./tanstack/admin/users/detail-route";
import { ADMIN_USERS_NAMESPACES } from "./tanstack/admin/users/route";
import { normalizeUsersRouteSearch } from "./tanstack/admin/users/route-search";
import { LOGIN_NAMESPACES } from "./tanstack/auth/login-route";
import {
  normalizePasswordResetSearch,
  PASSWORD_RESET_BASE_NAMESPACES,
} from "./tanstack/auth/recovery";
import { REGISTER_NAMESPACES } from "./tanstack/auth/register-route";
import {
  normalizeLoginSearch,
  normalizeSsoCallbackSearch,
} from "./tanstack/auth/route-search";
import { SSO_CALLBACK_NAMESPACES } from "./tanstack/auth/sso-route";
import { MY_FILES_NAMESPACES } from "./tanstack/files/route";
import { normalizeMyFilesRouteSearch } from "./tanstack/files/route-search";
import {
  AuthPendingSkeleton,
  CardsPendingSkeleton,
  FeedPendingSkeleton,
  FormPendingSkeleton,
  ProfilePendingSkeleton,
  TablePendingSkeleton,
} from "./tanstack/pending";
import { PROFILE_NAMESPACES } from "./tanstack/profile/route";
import {
  DISCOVER_NAMESPACES,
  SEARCH_NAMESPACES,
} from "./tanstack/search/namespaces";
import { normalizeSearchRouteSearch } from "./tanstack/search/route-search";
import { SETTINGS_NAMESPACES } from "./tanstack/settings/route";

/**
 * Every URL `@vitnode/core` owns, as the same kind of declaration a plugin
 * writes in its own `src/routes.tsx`.
 *
 * Browser-safe data and nothing else: a path, a shell, a guard, the skeleton to
 * draw while it loads, and one `lazy(() => import(...))` per screen. That is
 * what lets the build read this file in Node - it is imported by the Vite plugin
 * while the config is loading - and what keeps every page in a chunk of its own.
 *
 * A `pendingComponent` is the one thing imported outright: a router draws it
 * before the page's own chunk has arrived, so there is nothing to wait for it
 * and TanStack Router never code-splits one.
 *
 * Core is not a configured plugin, so nothing in an app's `vitnode.config.ts`
 * puts this tree in the registry; VitNode prepends it. See `CORE_PLUGIN_ID` in
 * `framework/plugin-routes`.
 */
export const routes = defineRoutes([
  page("/discover", {
    component: lazy(() => import("./pages/discover")),
    messages: DISCOVER_NAMESPACES,
    pendingComponent: FeedPendingSkeleton,
  }),

  page("/search", {
    component: lazy(() => import("./pages/search")),
    messages: SEARCH_NAMESPACES,
    pendingComponent: FeedPendingSkeleton,
    search: normalizeSearchRouteSearch,
  }),

  page("/users/:nameCode", {
    component: lazy(() => import("./pages/users/profile")),
    messages: PROFILE_NAMESPACES,
    pendingComponent: ProfilePendingSkeleton,
  }),

  page("/login", {
    component: lazy(() => import("./pages/login/index")),
    messages: LOGIN_NAMESPACES,
    pendingComponent: AuthPendingSkeleton,
    requires: "guest",
    search: normalizeLoginSearch,
  }),

  page("/register", {
    component: lazy(() => import("./pages/register")),
    messages: REGISTER_NAMESPACES,
    pendingComponent: AuthPendingSkeleton,
    requires: "guest",
  }),

  page("/login/reset-password", {
    component: lazy(() => import("./pages/login/reset-password")),
    messages: PASSWORD_RESET_BASE_NAMESPACES,
    pendingComponent: AuthPendingSkeleton,
    search: normalizePasswordResetSearch,
  }),

  page("/login/sso/:providerId", {
    component: lazy(() => import("./pages/login/sso")),
    messages: SSO_CALLBACK_NAMESPACES,
    pendingComponent: AuthPendingSkeleton,
    search: normalizeSsoCallbackSearch,
  }),

  layout("/settings", {
    component: lazy(() => import("./pages/settings/layout")),
    // Declared rather than loaded inside `load`, because this frame's crumb
    // renders these strings and a breadcrumb is drawn outside the page - so the
    // runtime has to know the namespaces to wrap it in them.
    messages: SETTINGS_NAMESPACES,
    pendingComponent: () => (
      <FormPendingSkeleton className="container mx-auto" />
    ),
    requires: "authenticated",
    children: [
      index({
        component: lazy(() => import("./pages/settings/index")),
        pendingComponent: FormPendingSkeleton,
      }),

      page("security", {
        component: lazy(() => import("./pages/settings/security")),
        pendingComponent: FormPendingSkeleton,
      }),

      page("devices", {
        component: lazy(() => import("./pages/settings/devices")),
        pendingComponent: () => <FeedPendingSkeleton rows={4} />,
      }),
    ],
  }),

  page("/files", {
    component: lazy(() => import("./pages/files")),
    messages: MY_FILES_NAMESPACES,
    pendingComponent: () => (
      <TablePendingSkeleton className="container mx-auto" />
    ),
    requires: "authenticated",
    search: normalizeMyFilesRouteSearch,
  }),
  page("/admin", {
    area: "blank",
    component: lazy(() => import("./pages/admin/sign-in")),
    messages: ADMIN_SIGN_IN_NAMESPACES,
    pendingComponent: AuthPendingSkeleton,
    requires: "admin-guest",
    search: normalizeAdminSignInSearch,
  }),

  page("/admin/core/advanced/cron", {
    area: "admin",
    component: lazy(() => import("./pages/admin/advanced/cron")),
    messages: ADMIN_CRON_NAMESPACES,
    pendingComponent: TablePendingSkeleton,
    search: normalizeCronRouteSearch,
  }),

  page("/admin/core/advanced/queue", {
    area: "admin",
    component: lazy(() => import("./pages/admin/advanced/queue")),
    messages: ADMIN_QUEUE_NAMESPACES,
    pendingComponent: TablePendingSkeleton,
    search: normalizeQueueRouteSearch,
  }),

  page("/admin/core/advanced/search", {
    area: "admin",
    component: lazy(() => import("./pages/admin/advanced/search")),
    messages: ADMIN_SEARCH_INDEX_NAMESPACES,
    pendingComponent: TablePendingSkeleton,
    search: normalizeSearchIndexRouteSearch,
  }),

  page("/admin/core/debug", {
    area: "admin",
    component: lazy(() => import("./pages/admin/debug")),
    messages: ADMIN_DEBUG_NAMESPACES,
    pendingComponent: TablePendingSkeleton,
    search: normalizeDebugRouteSearch,
  }),

  page("/admin/core/system/navigation", {
    area: "admin",
    component: lazy(() => import("./pages/admin/system/navigation")),
    messages: ADMIN_NAVIGATION_NAMESPACES,
    pendingComponent: TablePendingSkeleton,
  }),

  page("/admin/core/system/files", {
    area: "admin",
    component: lazy(() => import("./pages/admin/system/files")),
    messages: ADMIN_FILES_NAMESPACES,
    pendingComponent: TablePendingSkeleton,
    search: normalizeAdminFilesRouteSearch,
  }),

  page("/admin/core/system/integrations", {
    area: "admin",
    component: lazy(() => import("./pages/admin/system/integrations")),
    messages: ADMIN_INTEGRATIONS_NAMESPACES,
    pendingComponent: CardsPendingSkeleton,
  }),

  page("/admin/core/users", {
    area: "admin",
    component: lazy(() => import("./pages/admin/users/index")),
    messages: ADMIN_USERS_NAMESPACES,
    pendingComponent: TablePendingSkeleton,
    search: normalizeUsersRouteSearch,
  }),

  page("/admin/core/users/roles", {
    area: "admin",
    component: lazy(() => import("./pages/admin/users/roles")),
    messages: ADMIN_ROLES_NAMESPACES,
    pendingComponent: TablePendingSkeleton,
    search: normalizeRolesRouteSearch,
  }),

  page("/admin/core/users/:id", {
    area: "admin",
    component: lazy(() => import("./pages/admin/users/user")),
    messages: ADMIN_USER_NAMESPACES,
    pendingComponent: FormPendingSkeleton,
  }),

  page("/admin/core/staff/admins", {
    area: "admin",
    component: lazy(() => import("./pages/admin/staff/admins/index")),
    messages: ADMIN_STAFF_NAMESPACES,
    pendingComponent: TablePendingSkeleton,
    search: normalizeStaffRouteSearch,
  }),

  page("/admin/core/staff/admins/create", {
    area: "admin",
    component: lazy(() => import("./pages/admin/staff/admins/create")),
    messages: ADMIN_STAFF_CREATE_NAMESPACES,
    pendingComponent: FormPendingSkeleton,
  }),

  page("/admin/core/staff/admins/edit/:id", {
    area: "admin",
    component: lazy(() => import("./pages/admin/staff/admins/edit")),
    messages: ADMIN_STAFF_EDIT_NAMESPACES,
    pendingComponent: FormPendingSkeleton,
  }),

  page("/admin/core/staff/moderators", {
    area: "admin",
    component: lazy(() => import("./pages/admin/staff/moderators/index")),
    messages: ADMIN_STAFF_NAMESPACES,
    pendingComponent: TablePendingSkeleton,
    search: normalizeStaffRouteSearch,
  }),

  page("/admin/core/staff/moderators/create", {
    area: "admin",
    component: lazy(() => import("./pages/admin/staff/moderators/create")),
    messages: ADMIN_STAFF_CREATE_NAMESPACES,
    pendingComponent: FormPendingSkeleton,
  }),

  page("/admin/core/staff/moderators/edit/:id", {
    area: "admin",
    component: lazy(() => import("./pages/admin/staff/moderators/edit")),
    messages: ADMIN_STAFF_EDIT_NAMESPACES,
    pendingComponent: FormPendingSkeleton,
  }),

  page("/admin/content/*", {
    area: "admin",
    component: lazy(() => import("./pages/admin/content")),
    pendingComponent: TablePendingSkeleton,
    search: contentListRouteSearch,
  }),
]);
