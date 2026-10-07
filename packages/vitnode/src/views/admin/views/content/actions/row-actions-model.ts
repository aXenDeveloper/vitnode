export const CONTENT_ROW_INLINE_ACTION_LIMIT = 3;

export const CONTENT_ROW_ACTION_IDS = [
  "preview",
  "schedule",
  "history",
  "delivery",
  "duplicate",
  "visibility",
  "delete",
] as const;

export type ContentRowActionId = (typeof CONTENT_ROW_ACTION_IDS)[number];

/**
 * The actions the list implements itself, each behind its own confirmation -
 * everything else is an editorial panel a host registers.
 */
export const CONTENT_LIST_ACTION_IDS = [
  "duplicate",
  "visibility",
  "delete",
] as const satisfies readonly ContentRowActionId[];

export type ContentListActionId = (typeof CONTENT_LIST_ACTION_IDS)[number];

/** The four editorial ones - everything the list itself does not implement. */
export type ContentEditorialActionId = Exclude<
  ContentRowActionId,
  ContentListActionId
>;

export const CONTENT_EDITORIAL_ACTION_IDS = CONTENT_ROW_ACTION_IDS.filter(
  (id): id is ContentEditorialActionId =>
    !(CONTENT_LIST_ACTION_IDS as readonly string[]).includes(id),
);

/** Whether an action needs a confirmation and a destructive button. */
export const isDestructiveContentRowAction = (
  id: ContentRowActionId,
): boolean => id === "delete";

export interface ContentRowActionInput {
  /** `can_create` - a copy is a new record. */
  canCreate?: boolean;
  canDelete: boolean;
  /** `can_hide` - hiding and unhiding, and nothing else. */
  canHide?: boolean;
  canPublish: boolean;
  canView: boolean;
  /** `definition.delivery.enabled` - the canonical path and URL history. */
  delivery: boolean;
  /** `definition.duplication.enabled` - draft copies. */
  duplication?: boolean;
  /** `definition.editorial.enabled` - revisions, and therefore history. */
  editorial: boolean;
  /** `definition.editorial.preview.enabled` - signed draft links. */
  preview: boolean;

  renderable?: readonly ContentRowActionId[];
  /** `definition.editorial.scheduling.enabled` - publish/unpublish later. */
  scheduling: boolean;
  /** `definition.visibility.enabled` - hiding a record without unpublishing it. */
  visibility?: boolean;
}

const gateOf = (
  id: ContentRowActionId,
  {
    canCreate = false,
    canDelete,
    canHide = false,
    canPublish,
    canView,
  }: ContentRowActionInput,
): boolean => {
  switch (id) {
    case "delete":
      return canDelete;
    // The route checks both: creating is what it does, reading the source is
    // what it needs.
    case "duplicate":
      return canCreate && canView;
    case "schedule":
      return canPublish;
    case "visibility":
      return canHide;
    default:
      return canView;
  }
};

const featureOf = (
  id: ContentRowActionId,
  {
    delivery,
    duplication = false,
    editorial,
    preview,
    scheduling,
    visibility = false,
  }: ContentRowActionInput,
): boolean => {
  switch (id) {
    case "delete":
      return true;
    case "delivery":
      return delivery;
    case "duplicate":
      return duplication;
    case "history":
      return editorial;
    case "preview":
      return preview;
    case "schedule":
      return scheduling;
    case "visibility":
      return visibility;
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
