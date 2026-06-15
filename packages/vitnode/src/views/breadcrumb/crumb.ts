export interface BreadcrumbCrumb {
  href: string;
  isCurrent: boolean;
  /** Whether this crumb matched a known route (vs. a humanized fallback). */
  isKnown: boolean;
  isLink: boolean;
  label: string;
}

/**
 * Fallback label for path segments without an explicit label
 * (e.g. dev-only routes or dynamic resource ids): "reset-password" → "Reset Password".
 */
export const humanize = (segment: string): string =>
  decodeURIComponent(segment)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
