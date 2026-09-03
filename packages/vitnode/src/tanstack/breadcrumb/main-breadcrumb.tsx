"use client";

import { useMatches, useRouter } from "@tanstack/react-router";

import { BreadcrumbTrailContent } from "@/views/breadcrumb/breadcrumb-trail-content";

import { RouterLink } from "../layout/router-link";
import { useRouteNavigationPending } from "../pending/navigation-pending";
import { BreadcrumbPendingSkeleton } from "../pending/shapes";
import { breadcrumbTrail } from "./model";

export const MainBreadcrumb = () => {
  const entries = breadcrumbTrail(useMatches());
  const isNavigating = useRouteNavigationPending(
    useRouter().options.defaultPendingMs ?? 0,
  );

  if (entries.length === 0) return null;

  return (
    <div className="container mx-auto p-4">
      {isNavigating ? (
        <BreadcrumbPendingSkeleton />
      ) : (
        <BreadcrumbTrailContent entries={entries} LinkComponent={RouterLink} />
      )}
    </div>
  );
};
