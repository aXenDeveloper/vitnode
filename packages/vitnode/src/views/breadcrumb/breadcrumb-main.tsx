import { BreadcrumbRender } from "./breadcrumb-render";
import { resolveMainBreadcrumb } from "./resolve-main-breadcrumb";

export interface BreadcrumbMainProps {
  labels?: Record<string, string>;
  overrideLastLabel?: string;
  segments: string[];
}

export const BreadcrumbMain = ({
  segments,
  labels,
  overrideLastLabel,
}: BreadcrumbMainProps) => {
  const crumbs = resolveMainBreadcrumb(segments, labels);

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
