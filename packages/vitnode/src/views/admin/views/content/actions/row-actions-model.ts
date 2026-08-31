/**
 * Which actions one content row offers, and whether they fit as buttons.
 *
 * Pure: no React, no permissions provider, no definition - just the four
 * features a content type can enable, the three permissions that gate them, and
 * the answer. Both AdminCPs read it, so a row in the Next.js list and the same
 * row in the TanStack Start list offer the same actions in the same order, and
 * neither can grow a fifth by accident.
 *
 * Worth extracting because every rule here is one somebody would otherwise
 * restate. "Preview needs `can_view`, scheduling needs `can_publish`" is not
 * guessable from the names, and getting it wrong in one host shows an action
 * whose request the API refuses - a control that looks broken rather than absent.
 */

/**
 * Above this many actions the row collapses into a `⋯` menu.
 *
 * Three fits beside the publish and edit buttons on the narrowest table the
 * AdminCP renders; four starts pushing the last column into a scroll.
 */
export const CONTENT_ROW_INLINE_ACTION_LIMIT = 3;

/**
 * Every row action, in the order they are offered.
 *
 * The order is part of the contract rather than an implementation detail: the
 * destructive one is last so it is never where a mis-click lands, and the four
 * before it read from least to most consequential.
 */
export const CONTENT_ROW_ACTION_IDS = [
  "preview",
  "schedule",
  "history",
  "delivery",
  "delete",
] as const;

export type ContentRowActionId = (typeof CONTENT_ROW_ACTION_IDS)[number];

/** The four editorial ones - everything the list itself does not implement. */
export type ContentEditorialActionId = Exclude<ContentRowActionId, "delete">;

export const CONTENT_EDITORIAL_ACTION_IDS = CONTENT_ROW_ACTION_IDS.filter(
  (id): id is ContentEditorialActionId => id !== "delete",
);

/** Whether an action needs a confirmation and a destructive button. */
export const isDestructiveContentRowAction = (
  id: ContentRowActionId,
): boolean => id === "delete";

export interface ContentRowActionInput {
  canDelete: boolean;
  canPublish: boolean;
  canView: boolean;
  /** `definition.delivery.enabled` - the canonical path and URL history. */
  delivery: boolean;
  /** `definition.editorial.enabled` - revisions, and therefore history. */
  editorial: boolean;
  /** `definition.editorial.preview.enabled` - signed draft links. */
  preview: boolean;
  /**
   * Which of the ids this host can actually put a panel behind.
   *
   * Defaults to all of them, for a host that imports every panel directly. A
   * host that renders the editorial panels through a registered slot passes the
   * subset it registered, because an action whose panel nobody registered must
   * not be offered: a menu entry that opens nothing is worse than an absent one.
   */
  renderable?: readonly ContentRowActionId[];
  /** `definition.editorial.scheduling.enabled` - publish/unpublish later. */
  scheduling: boolean;
}

/**
 * The permission each action is gated on, stated once.
 *
 * Reading rather than writing is the rule, with one exception: scheduling *is*
 * publishing, just later, so it is gated on `can_publish` rather than on
 * `can_view`. Every one of these is re-checked by the API on the request itself;
 * this decides what to render.
 */
const gateOf = (
  id: ContentRowActionId,
  { canDelete, canPublish, canView }: ContentRowActionInput,
): boolean => {
  switch (id) {
    case "delete":
      return canDelete;
    case "schedule":
      return canPublish;
    default:
      return canView;
  }
};

const featureOf = (
  id: ContentRowActionId,
  { delivery, editorial, preview, scheduling }: ContentRowActionInput,
): boolean => {
  switch (id) {
    case "delete":
      return true;
    case "delivery":
      return delivery;
    case "history":
      return editorial;
    case "preview":
      return preview;
    case "schedule":
      return scheduling;
  }
};

/** The actions this row offers this administrator, in order. */
export const contentRowActionIds = (
  input: ContentRowActionInput,
): ContentRowActionId[] =>
  CONTENT_ROW_ACTION_IDS.filter(
    id =>
      (input.renderable ?? CONTENT_ROW_ACTION_IDS).includes(id) &&
      featureOf(id, input) &&
      gateOf(id, input),
  );

/**
 * Whether the actions render as buttons rather than behind a `⋯`.
 *
 * `false` for none of them too, which is not a rounding error: the caller
 * renders nothing at all in that case, and a menu button opening an empty menu
 * would be the alternative.
 */
export const contentRowActionsAreInline = (count: number): boolean =>
  count > 0 && count <= CONTENT_ROW_INLINE_ACTION_LIMIT;
