import { defineRoutes, index, layout, lazy, page } from "./routing";
import { ADMIN_AI_NAMESPACES } from "./tanstack/admin/ai/route";
import {
  normalizeAiHistoryRouteSearch,
  normalizeAiOverviewSearch,
} from "./tanstack/admin/ai/route-search";
import { contentListRouteSearch } from "./tanstack/admin/content/route-search";
import { normalizeCronRouteSearch } from "./tanstack/admin/cron/route-search";
import {
  DebugAiPending,
  DebugCachePending,
  DebugCronPending,
  DebugLayoutPending,
  DebugLogsPending,
  DebugOverviewPending,
  DebugPluginsPending,
  DebugQueuePending,
  DebugSearchPending,
  DebugServicesPending,
  DebugVitnodePending,
} from "./tanstack/admin/debug/pending";
import { ADMIN_DEBUG_NAMESPACES } from "./tanstack/admin/debug/route";
import { normalizeDebugLogsSearch } from "./tanstack/admin/debug/route-search";
import { ADMIN_FILES_NAMESPACES } from "./tanstack/admin/files/route";
import { normalizeAdminFilesRouteSearch } from "./tanstack/admin/files/route-search";
import { ADMIN_INTEGRATIONS_NAMESPACES } from "./tanstack/admin/integrations/route";
import { ADMIN_NOTIFICATIONS_NAMESPACES } from "./tanstack/admin/notifications/route";
import { ADMIN_OG_IMAGES_NAMESPACES } from "./tanstack/admin/og-images/route";
import { ADMIN_PLUGINS_NAMESPACES } from "./tanstack/admin/plugins/route";
import { normalizeQueueRouteSearch } from "./tanstack/admin/queue/route-search";
import { ADMIN_REPORT_REASONS_NAMESPACES } from "./tanstack/admin/report-reasons/route";
import { ADMIN_ROLES_NAMESPACES } from "./tanstack/admin/roles/route";
import { normalizeRolesRouteSearch } from "./tanstack/admin/roles/route-search";
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
  LoginPendingSkeleton,
  RegisterPendingSkeleton,
} from "./tanstack/auth/pending";
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
import {
  normalizeVerifyEmailSearch,
  VERIFY_EMAIL_NAMESPACES,
} from "./tanstack/auth/verify-email";
import { MY_FILES_NAMESPACES } from "./tanstack/files/route";
import { normalizeMyFilesRouteSearch } from "./tanstack/files/route-search";
import { normalizeModcpApprovalsSearch } from "./tanstack/moderation/approvals-route-search";
import { MODCP_NAMESPACES } from "./tanstack/moderation/namespaces";
import { normalizeModcpReportsSearch } from "./tanstack/moderation/route-search";
import { NOTIFICATIONS_NAMESPACES } from "./tanstack/notifications/namespaces";
import { normalizeNotificationsRouteSearch } from "./tanstack/notifications/route-search";
import {
  AuthPendingSkeleton,
  CardsPendingSkeleton,
  DiscoverPendingSkeleton,
  FeedPendingSkeleton,
  FormPendingSkeleton,
  ProfilePendingSkeleton,
  SearchPendingSkeleton,
  TablePendingSkeleton,
} from "./tanstack/pending";
import { PROFILE_NAMESPACES } from "./tanstack/profile/route";
import {
  DISCOVER_NAMESPACES,
  SEARCH_NAMESPACES,
} from "./tanstack/search/namespaces";
import { normalizeSearchRouteSearch } from "./tanstack/search/route-search";
import { SETTINGS_NAMESPACES } from "./tanstack/settings/route";
import { normalizeSsoSettingsSearch } from "./tanstack/sso-connections/route-search";

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
    pendingComponent: DiscoverPendingSkeleton,
  }),

  page("/search", {
    component: lazy(() => import("./pages/search")),
    messages: SEARCH_NAMESPACES,
    pendingComponent: SearchPendingSkeleton,
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
    pendingComponent: LoginPendingSkeleton,
    requires: "guest",
    search: normalizeLoginSearch,
  }),

  page("/register", {
    component: lazy(() => import("./pages/register")),
    messages: REGISTER_NAMESPACES,
    pendingComponent: RegisterPendingSkeleton,
    requires: "guest",
  }),

  page("/login/reset-password", {
    component: lazy(() => import("./pages/login/reset-password")),
    messages: PASSWORD_RESET_BASE_NAMESPACES,
    pendingComponent: AuthPendingSkeleton,
    search: normalizePasswordResetSearch,
  }),

  page("/login/verify-email", {
    component: lazy(() => import("./pages/login/verify-email")),
    messages: VERIFY_EMAIL_NAMESPACES,
    pendingComponent: AuthPendingSkeleton,
    search: normalizeVerifyEmailSearch,
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

      page("notifications", {
        component: lazy(() => import("./pages/settings/notifications")),
        pendingComponent: FormPendingSkeleton,
      }),

      page("devices", {
        component: lazy(() => import("./pages/settings/devices")),
        pendingComponent: () => <FeedPendingSkeleton rows={4} />,
      }),

      page("sso", {
        component: lazy(() => import("./pages/settings/sso")),
        pendingComponent: FormPendingSkeleton,
        search: normalizeSsoSettingsSearch,
      }),

      page("ai", {
        component: lazy(() => import("./pages/settings/ai")),
        pendingComponent: () => <FeedPendingSkeleton rows={4} />,
      }),
    ],
  }),

  layout("/modcp", {
    component: lazy(() => import("./pages/modcp/layout")),
    messages: MODCP_NAMESPACES,
    pendingComponent: () => (
      <TablePendingSkeleton className="container mx-auto" />
    ),
    requires: "authenticated",
    children: [
      index({
        component: lazy(() => import("./pages/modcp/index")),
      }),

      page("reports", {
        component: lazy(() => import("./pages/modcp/reports")),
        pendingComponent: TablePendingSkeleton,
        search: normalizeModcpReportsSearch,
      }),

      page("reports/:id", {
        component: lazy(() => import("./pages/modcp/report")),
        pendingComponent: () => <FeedPendingSkeleton rows={4} />,
      }),

      page("approvals", {
        component: lazy(() => import("./pages/modcp/approvals")),
        pendingComponent: () => <FeedPendingSkeleton rows={5} />,
        search: normalizeModcpApprovalsSearch,
      }),

      page("approvals/:id", {
        component: lazy(() => import("./pages/modcp/approval")),
        pendingComponent: () => <FeedPendingSkeleton rows={4} />,
      }),
    ],
  }),

  page("/notifications", {
    component: lazy(() => import("./pages/notifications")),
    messages: NOTIFICATIONS_NAMESPACES,
    pendingComponent: () => <FeedPendingSkeleton rows={6} />,
    requires: "authenticated",
    search: normalizeNotificationsRouteSearch,
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

  page("/admin/core/ai", {
    area: "admin",
    component: lazy(() => import("./pages/admin/ai/index")),
    messages: ADMIN_AI_NAMESPACES,
    pendingComponent: CardsPendingSkeleton,
    search: normalizeAiOverviewSearch,
  }),

  page("/admin/core/ai/actions", {
    area: "admin",
    component: lazy(() => import("./pages/admin/ai/actions")),
    messages: ADMIN_AI_NAMESPACES,
    pendingComponent: TablePendingSkeleton,
  }),

  layout("/admin/core/debug", {
    area: "admin",
    component: lazy(() => import("./pages/admin/debug/layout")),
    messages: ADMIN_DEBUG_NAMESPACES,
    pendingComponent: DebugLayoutPending,
    children: [
      index({
        component: lazy(() => import("./pages/admin/debug/index")),
        pendingComponent: DebugOverviewPending,
      }),
      page("vitnode", {
        component: lazy(() => import("./pages/admin/debug/vitnode")),
        pendingComponent: DebugVitnodePending,
      }),
      page("plugins", {
        component: lazy(() => import("./pages/admin/debug/plugins")),
        pendingComponent: DebugPluginsPending,
      }),
      page("cron", {
        component: lazy(() => import("./pages/admin/debug/cron")),
        pendingComponent: DebugCronPending,
        search: normalizeCronRouteSearch,
      }),
      page("cache", {
        component: lazy(() => import("./pages/admin/debug/cache")),
        pendingComponent: DebugCachePending,
      }),
      page("search", {
        component: lazy(() => import("./pages/admin/debug/search")),
        pendingComponent: DebugSearchPending,
        search: normalizeSearchIndexRouteSearch,
      }),
      page("services", {
        component: lazy(() => import("./pages/admin/debug/services")),
        pendingComponent: DebugServicesPending,
      }),
      page("logs", {
        component: lazy(() => import("./pages/admin/debug/logs")),
        pendingComponent: DebugLogsPending,
        search: normalizeDebugLogsSearch,
      }),
      page("queue", {
        component: lazy(() => import("./pages/admin/debug/queue")),
        pendingComponent: DebugQueuePending,
        search: normalizeQueueRouteSearch,
      }),
      page("ai", {
        component: lazy(() => import("./pages/admin/debug/ai")),
        pendingComponent: DebugAiPending,
        search: normalizeAiHistoryRouteSearch,
      }),
    ],
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

  page("/admin/core/system/plugins", {
    area: "admin",
    component: lazy(() => import("./pages/admin/system/plugins")),
    messages: ADMIN_PLUGINS_NAMESPACES,
    pendingComponent: TablePendingSkeleton,
  }),

  page("/admin/core/system/notifications", {
    area: "admin",
    component: lazy(() => import("./pages/admin/system/notifications")),
    messages: ADMIN_NOTIFICATIONS_NAMESPACES,
    pendingComponent: CardsPendingSkeleton,
  }),

  page("/admin/core/seo/og-images", {
    area: "admin",
    component: lazy(() => import("./pages/admin/seo/og-images")),
    messages: ADMIN_OG_IMAGES_NAMESPACES,
    pendingComponent: FormPendingSkeleton,
  }),

  page("/admin/core/moderation/report-reasons", {
    area: "admin",
    component: lazy(() => import("./pages/admin/moderation/report-reasons")),
    messages: ADMIN_REPORT_REASONS_NAMESPACES,
    pendingComponent: TablePendingSkeleton,
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

  page("/admin/containers/*", {
    area: "admin",
    component: lazy(() => import("./pages/admin/containers")),
    pendingComponent: TablePendingSkeleton,
  }),
]);
