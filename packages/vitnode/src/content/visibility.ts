import type { CONTENT_VISIBILITY_ACTIONS } from "./const";
import type {
  AnyContentTypeDefinition,
  ContentVisibilityFilter,
} from "./types";

export type { ContentVisibilityFilter };

/** `hide` or `unhide` - the route segment each posts to, and the revision operation. */
export type ContentVisibilityAction =
  (typeof CONTENT_VISIBILITY_ACTIONS)[number];

/** Whether a row - as any admin response carries it - is hidden right now. */
export const isContentHidden = (row: { hiddenAt?: unknown }): boolean =>
  row.hiddenAt !== null && row.hiddenAt !== undefined && row.hiddenAt !== "";

/** What pressing the one visibility toggle on a row does. */
export interface ContentVisibilityTransition {
  action: ContentVisibilityAction;
  /** Whether pressing it takes something away from the public site. */
  destructive: boolean;
  to: ContentVisibilityFilter;
}

const HIDE: ContentVisibilityTransition = {
  action: "hide",
  destructive: true,
  to: "hidden",
};

const UNHIDE: ContentVisibilityTransition = {
  action: "unhide",
  destructive: false,
  to: "visible",
};

export const contentVisibilityTransition = (row: {
  hiddenAt?: unknown;
}): ContentVisibilityTransition => (isContentHidden(row) ? UNHIDE : HIDE);

export const hasContentVisibility = (
  definition: AnyContentTypeDefinition,
): boolean => definition.visibility.enabled;
