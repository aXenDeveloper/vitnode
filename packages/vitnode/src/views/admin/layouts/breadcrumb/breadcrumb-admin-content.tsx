import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { BreadcrumbCrumbItems } from "@/views/breadcrumb/breadcrumb-render-content";

import type { NavAdminParent } from "../sidebar/nav/nav-model";

import { resolveBreadcrumb } from "./resolve-breadcrumb";

export interface BreadcrumbAdminContentProps {
  /** Explicit labels by href, for a crumb the navigation cannot name. */
  labels?: Record<string, string>;
  LinkComponent: AuthLinkComponent;
  /**
   * The visible navigation, which is where crumb labels come from.
   *
   * The *visible* one specifically: it has already been filtered by this admin's
   * permissions, so a crumb can only ever be named after a screen they may open.
   * An unnamed segment falls back to a humanized spelling and is not a link.
   */
  nav: NavAdminParent[];
  /** The last crumb's label, when the page knows it and the navigation cannot. */
  overrideLastLabel?: string;
  /** The path below `/admin`, e.g. `["core", "users"]`. */
  segments: string[];
}

/**
 * The AdminCP breadcrumb, framework-free.
 *
 * Labels come from the navigation rather than from a registry of their own, and
 * that is the point: the sidebar and the trail name the same screen the same
 * way, in every language, without anybody maintaining a second list that agrees
 * until it doesn't. A plugin that adds a nav entry gets a breadcrumb label for
 * free, and one that adds a screen *without* a nav entry gets a humanized
 * fallback rather than a blank.
 *
 * ## What decides which trail is shown
 *
 * Not this component. The matched route declares it as `staticData.breadcrumb`,
 * and because one AdminCP route is usually several segments deep it declares a
 * `breadcrumbGroup` - so these items go straight into the shell's own list,
 * separators and all. There is no map from pathname to trail anywhere, and
 * nothing registers into one.
 *
 * Items rather than a list of its own: the shell renders one navigation landmark
 * and one `<ol>` for the whole trail, whichever routes contributed to it.
 */
export const BreadcrumbAdminContent = ({
  labels,
  LinkComponent,
  nav,
  overrideLastLabel,
  segments,
}: BreadcrumbAdminContentProps) => {
  const crumbs = resolveBreadcrumb(nav, segments);

  if (crumbs.length === 0) return null;

  if (labels) {
    for (const crumb of crumbs) {
      const label = labels[crumb.href];
      if (label !== undefined) {
        crumb.label = label;
        crumb.isLink = !crumb.isCurrent;
      }
    }
  }

  if (overrideLastLabel) {
    crumbs[crumbs.length - 1].label = overrideLastLabel;
  }

  return <BreadcrumbCrumbItems crumbs={crumbs} LinkComponent={LinkComponent} />;
};
