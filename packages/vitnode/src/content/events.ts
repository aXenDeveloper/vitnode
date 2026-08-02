import type { ContentFieldName } from "./types";

export type ContentEventAction = "created" | "deleted" | "updated";

export interface ContentCreatedPayload {
  contentId: number;
}

export interface ContentDeletedPayload {
  contentId: number;
}

export interface ContentUpdatedPayload<TDefinition> {
  changedFields: ContentFieldName<TDefinition>[];
  contentId: number;
}

/**
 * The three events a content type emits, as a literal-keyed map.
 *
 * Plugins graft these onto the global event map with one declaration - the
 * same module-augmentation mechanism every other VitNode event uses:
 *
 * ```ts
 * declare module "@vitnode/core/api/models/events" {
 *   interface VitNodeEvents
 *     extends ContentEventsFor<typeof articleContentType> {}
 * }
 * ```
 *
 * `TDefinition` is concrete at the augmentation site, so the keys are
 * statically known and `changedFields` narrows to the content type's own field
 * names. The envelope already carries the actor, plugin and timestamp, so the
 * payloads stay minimal.
 */
export type ContentEventsFor<TDefinition extends { id: string }> = Record<
  `content.${TDefinition["id"]}.created`,
  ContentCreatedPayload
> &
  Record<`content.${TDefinition["id"]}.deleted`, ContentDeletedPayload> &
  Record<
    `content.${TDefinition["id"]}.updated`,
    ContentUpdatedPayload<TDefinition>
  >;

export const contentEventName = <
  TId extends string,
  TAction extends ContentEventAction,
>(
  contentTypeId: TId,
  action: TAction,
): `content.${TId}.${TAction}` => `content.${contentTypeId}.${action}`;
