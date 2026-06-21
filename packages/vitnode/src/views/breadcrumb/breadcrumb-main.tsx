import { BreadcrumbRender } from "./breadcrumb-render";
import { resolveMainBreadcrumb } from "./resolve-main-breadcrumb";

export interface BreadcrumbMainProps {
  /** Cumulative href → translated label, for known public pages. */
  labels?: Record<string, string>;
  /** Overrides the label of the last (current) crumb. */
  overrideLastLabel?: string;
  /** Path segments after `/`, e.g. `["login", "reset-password"]`. */
  segments: string[];
}

export const BreadcrumbMain = ({
  segments,
  labels,
  overrideLastLabel,
}: BreadcrumbMainProps) => {
  const crumbs = resolveMainBreadcrumb(segments, labels);

  // No breadcrumb on the home page (no segments).
  if (crumbs.length === 0) return null;

  if (overrideLastLabel) {
    crumbs[crumbs.length - 1].label = overrideLastLabel;
  }

  return (
    <div className="container mx-auto p-4">
      <BreadcrumbRender crumbs={crumbs} />
    </div>
  );
};
