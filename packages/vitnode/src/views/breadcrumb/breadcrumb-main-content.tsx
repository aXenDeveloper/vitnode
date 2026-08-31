import type { AuthLinkComponent } from "../auth/auth-link";

import { BreadcrumbRenderContent } from "./breadcrumb-render-content";
import { resolveMainBreadcrumb } from "./resolve-main-breadcrumb";

export interface BreadcrumbMainContentProps {
  labels?: Record<string, string>;
  LinkComponent: AuthLinkComponent;
  overrideLastLabel?: string;
  segments: string[];
}

/**
 * The public site's breadcrumb, framework-free.
 *
 * The same two steps `BreadcrumbMain` has always taken - path segments into
 * crumbs, crumbs into markup - with the link handed in rather than imported. The
 * container is here rather than at each call site so both frameworks get the
 * same spacing: Next.js renders this into the `@breadcrumb` parallel slot,
 * TanStack Start into the shell's breadcrumb area through
 * `staticData.breadcrumb`.
 */
export const BreadcrumbMainContent = ({
  labels,
  LinkComponent,
  overrideLastLabel,
  segments,
}: BreadcrumbMainContentProps) => {
  const crumbs = resolveMainBreadcrumb(segments, labels);

  if (crumbs.length === 0) return null;

  if (overrideLastLabel) {
    crumbs[crumbs.length - 1].label = overrideLastLabel;
  }

  return (
    <div className="container mx-auto p-4">
      <BreadcrumbRenderContent crumbs={crumbs} LinkComponent={LinkComponent} />
    </div>
  );
};
