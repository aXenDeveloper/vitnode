import { useMatches, useRouter } from "@tanstack/react-router";

import type { PluginRouteBreadcrumbGroup } from "@/routing";

import { BreadcrumbAdminContent } from "@/views/admin/layouts/breadcrumb/breadcrumb-admin-content";
import { BreadcrumbTrailContent } from "@/views/breadcrumb/breadcrumb-trail-content";

import { useBreadcrumbTrail } from "../breadcrumb/model";
import { useRouteNavigationPending } from "../pending/navigation-pending";
import { BreadcrumbPendingSkeleton } from "../pending/shapes";
import { routeBreadcrumbGroup } from "../plugin-routes/authoring";
import { useAdminNav } from "./nav";

export const useAdminBreadcrumb = (): React.ReactNode => {
  const entries = useBreadcrumbTrail(useMatches());
  const isNavigating = useRouteNavigationPending(
    useRouter().options.defaultPendingMs ?? 0,
  );

  if (entries.length === 0) return null;

  if (isNavigating) return <BreadcrumbPendingSkeleton />;

  return <BreadcrumbTrailContent entries={entries} scrollable />;
};

export const AdminBreadcrumb = ({
  labels,
  overrideLastLabel,
  segments,
}: {
  /** Explicit labels by href, for a crumb the navigation cannot name. */
  labels?: Record<string, string>;
  /** The last crumb's label, when the page knows it and the navigation cannot. */
  overrideLastLabel?: string;
  /** The path below `/admin`, e.g. `["core", "users"]`. */
  segments: string[];
}) => (
  <BreadcrumbAdminContent
    labels={labels}
    nav={useAdminNav()}
    overrideLastLabel={overrideLastLabel}
    segments={segments}
  />
);

export const adminBreadcrumb = <TData = unknown, TSearch = unknown>(
  props: Parameters<typeof AdminBreadcrumb>[0],
): PluginRouteBreadcrumbGroup<TData, TSearch> =>
  routeBreadcrumbGroup(function AdminRouteBreadcrumb() {
    return <AdminBreadcrumb {...props} />;
  });
