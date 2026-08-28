import { Link } from "@/lib/navigation";

import type { BreadcrumbMainContentProps } from "./breadcrumb-main-content";

import { BreadcrumbMainContent } from "./breadcrumb-main-content";

export type BreadcrumbMainProps = Omit<
  BreadcrumbMainContentProps,
  "LinkComponent"
>;

/** {@link BreadcrumbMainContent}, wired to `next-intl`'s locale-aware `Link`. */
export const BreadcrumbMain = (props: BreadcrumbMainProps) => (
  <BreadcrumbMainContent {...props} LinkComponent={Link} />
);
