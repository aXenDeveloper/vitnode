"use client";

import { useMatches, useRouter } from "@tanstack/react-router";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { BreadcrumbAdminContent } from "@/views/admin/layouts/breadcrumb/breadcrumb-admin-content";
import { BreadcrumbTrailContent } from "@/views/breadcrumb/breadcrumb-trail-content";

import type { RouteBreadcrumbGroup } from "../breadcrumb/model";

import { breadcrumbGroup, breadcrumbTrail } from "../breadcrumb/model";
import { RouterLink } from "../layout/router-link";
import { useRouteNavigationPending } from "../pending/navigation-pending";
import { BreadcrumbPendingSkeleton } from "../pending/shapes";
import { useAdminNav } from "./nav";

export const useAdminBreadcrumb = (): React.ReactNode => {
  const entries = breadcrumbTrail(useMatches());
  const isNavigating = useRouteNavigationPending(
    useRouter().options.defaultPendingMs ?? 0,
  );

  if (entries.length === 0) return null;

  if (isNavigating) return <BreadcrumbPendingSkeleton />;

  return (
    <BreadcrumbTrailContent
      entries={entries}
      LinkComponent={RouterLink}
      scrollable
    />
  );
};

export const AdminBreadcrumb = ({
  labels,
  LinkComponent = RouterLink,
  overrideLastLabel,
  segments,
}: {
  /** Explicit labels by href, for a crumb the navigation cannot name. */
  labels?: Record<string, string>;
  LinkComponent?: AuthLinkComponent;
  /** The last crumb's label, when the page knows it and the navigation cannot. */
  overrideLastLabel?: string;
  /** The path below `/admin`, e.g. `["core", "users"]`. */
  segments: string[];
}) => (
  <BreadcrumbAdminContent
    labels={labels}
    LinkComponent={LinkComponent}

    nav={useAdminNav()}
    overrideLastLabel={overrideLastLabel}
    segments={segments}
  />
);

export const adminBreadcrumb = (
  props: Parameters<typeof AdminBreadcrumb>[0],
): RouteBreadcrumbGroup =>
  breadcrumbGroup(function AdminRouteBreadcrumb() {
    return <AdminBreadcrumb {...props} />;
  });
