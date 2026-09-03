export const CONTENT_ROW_INLINE_ACTION_LIMIT = 3;

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

  renderable?: readonly ContentRowActionId[];
  /** `definition.editorial.scheduling.enabled` - publish/unpublish later. */
  scheduling: boolean;
}

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

export const contentRowActionsAreInline = (count: number): boolean =>
  count > 0 && count <= CONTENT_ROW_INLINE_ACTION_LIMIT;
