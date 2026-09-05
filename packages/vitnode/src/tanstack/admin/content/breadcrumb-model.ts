import type { ContentAdminAction } from "@/content/index";
import type { ContentRouteLabels } from "@/views/admin/views/content/content-labels";

import {
  CONTENT_ADMIN_CREATE_SEGMENT,
  CONTENT_ADMIN_EDIT_SEGMENT,
} from "@/content/index";

/** `/admin/content/blog/articles` - the list URL the trail passes through. */
export const contentBreadcrumbListHref = (adminPath: string): string =>
  `/admin/content/${adminPath}`;

/**
 * The trail, as data.
 *
 * `none` is a first-class answer rather than an empty segment list, because the
 * two mean different things to the shell: no trail at all, versus a trail whose
 * every crumb happened to resolve to nothing.
 */
export type ContentBreadcrumbModel =
  | {
      action: Exclude<ContentAdminAction, "list">;
      kind: "form";
      /** The list URL, which the trail passes *through* rather than ends at. */
      listHref: string;
      segments: string[];
      /** The content type's singular, for the last crumb's own sentence. */
      singular: string;
      /** The content type's noun, for the crumb the navigation cannot label. */
      title: string;
    }
  | { kind: "list"; segments: string[]; title: string }
  | { kind: "none" };

/**
 * The empty trail, as a value.
 *
 * A shared constant so a caller can compare against it and a test can name it,
 * rather than each spelling `{ kind: "none" }` and one of them drifting.
 */
export const CONTENT_BREADCRUMB_NONE: ContentBreadcrumbModel = { kind: "none" };

/** What the route's loader data offers a breadcrumb - all of it optional. */
export interface ContentBreadcrumbInput {
  action?: ContentAdminAction;
  adminPath?: string;
  labels?: ContentRouteLabels;
}

/**
 * The trail for one content URL, or {@link CONTENT_BREADCRUMB_NONE}.
 *
 * Total by construction: every input is optional, because the caller's are. The
 * three that must be present are checked together and `action` is among them -
 * a resolved route always has one, and treating an absent one as "not resolved"
 * is what keeps the guard from having a hole. Before this was extracted the
 * component's ternary fell through to the *form* branch when `action` was
 * missing, which is the branch that reads a label.
 *
 * The **list** crumb needs no label map: the sidebar already has an entry at
 * `/admin/content/{admin.path}` carrying this content type's noun, and
 * `AdminBreadcrumb` resolves labels from the navigation this administrator can
 * see. `title` is carried anyway because the screen's heading may legitimately
 * differ from the sidebar's shorter name.
 *
 * The **form** crumbs need two: the parent, because the trail passes through the
 * list URL, and the last segment - `create` / `edit` - which is not a page the
 * navigation knows about at all.
 */
export const contentBreadcrumbModel = ({
  action,
  adminPath,
  labels,
}: ContentBreadcrumbInput = {}): ContentBreadcrumbModel => {
  if (action === undefined || adminPath === undefined || labels === undefined) {
    return CONTENT_BREADCRUMB_NONE;
  }

  const segments = ["content", ...adminPath.split("/")];

  if (action === "list") {
    return { kind: "list", segments, title: labels.title };
  }

  return {
    action,
    kind: "form",
    listHref: contentBreadcrumbListHref(adminPath),
    segments: [
      ...segments,
      action === "create"
        ? CONTENT_ADMIN_CREATE_SEGMENT
        : CONTENT_ADMIN_EDIT_SEGMENT,
    ],
    singular: labels.singular,
    title: labels.title,
  };
};
