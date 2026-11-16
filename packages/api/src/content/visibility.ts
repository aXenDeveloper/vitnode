import type { CONTENT_VISIBILITY_ACTIONS } from "./const";
import type { ContentVisibilityFilter } from "./types";

export type ContentVisibilityAction =
  (typeof CONTENT_VISIBILITY_ACTIONS)[number];

/** Whether a moderator has hidden the record (`hiddenAt` is set). */
export const isContentHidden = (row: { hiddenAt?: unknown }): boolean =>
  row.hiddenAt !== null && row.hiddenAt !== undefined && row.hiddenAt !== "";

export interface ContentVisibilityTransition {
  action: ContentVisibilityAction;
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

/** The hide/unhide transition a moderator toggle offers for this row. */
export const contentVisibilityTransition = (row: {
  hiddenAt?: unknown;
}): ContentVisibilityTransition => (isContentHidden(row) ? UNHIDE : HIDE);
