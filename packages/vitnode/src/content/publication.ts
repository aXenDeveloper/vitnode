import type {
  AnyContentTypeDefinition,
  ContentPublicationStatus,
} from "./types";

import { isContentPublicationStatus } from "./const";

/**
 * The publication lifecycle, as a screen has to reason about it.
 *
 * Pure, framework-neutral, and the *only* place a control is allowed to decide
 * what `status` means. Every AdminCP surface that offers publishing - a list
 * row's button, the form's status badge, a schedule's action select - reads a
 * row's `status` off a JSON response typed `unknown`, and each of them used to
 * answer the question the same way and separately:
 *
 *     const published = row.status === "published";
 *
 * Five copies of one string literal, in two frontends, none of them checked
 * against `CONTENT_PUBLICATION_STATUSES`. That is exactly the kind of duplicate
 * rule that survives a rename of the constant it was copied from, so the reading
 * lives here and the literal appears once.
 *
 * ## Nothing here is the state machine itself
 *
 * The transitions are the API's: `POST /{id}/publish` and `POST /{id}/unpublish`
 * are idempotent, guarded by `can_publish`, and `publishedCondition` is what the
 * database enforces. This module only says which of the two a row is offered and
 * what it would become - the arithmetic a button needs to render, and never a
 * substitute for the server's answer.
 *
 * A **scheduled** publication is not a third state and deliberately does not
 * appear here: a schedule is a row in `core_content_schedules` that performs one
 * of these two transitions later. See `content/schedules.ts`.
 */

/**
 * The state a record is in when it has never been through the lifecycle.
 *
 * `draft`, which is also the column default. A row arriving without a `status` -
 * a content type with no publication layer, or a projection that did not select
 * the column - is unpublished as far as any control is concerned, which is the
 * reading that keeps a "Publish" button from being hidden on a record nobody can
 * publish any other way.
 */
export const CONTENT_DEFAULT_PUBLICATION_STATUS: ContentPublicationStatus =
  "draft";

export type { ContentPublicationStatus };

/**
 * A row's `status`, as one of the two the engine knows.
 *
 * The values arrive off `JSON.parse`, so this takes `unknown` on purpose rather
 * than pretending the wire is typed. Anything the engine does not recognise -
 * a status from a newer API, `null`, a number - reads as
 * {@link CONTENT_DEFAULT_PUBLICATION_STATUS}, because an unknown state is not a
 * published one and offering "Unpublish" for it would be a request the API
 * refuses.
 */
export const contentPublicationStatus = (
  value: unknown,
): ContentPublicationStatus =>
  isContentPublicationStatus(value)
    ? value
    : CONTENT_DEFAULT_PUBLICATION_STATUS;

/** Whether a record is in the published state right now. */
export const isContentPublished = (value: unknown): boolean =>
  contentPublicationStatus(value) === "published";

/** The two transitions, and the route segment each posts to. */
export const CONTENT_PUBLICATION_ACTIONS = ["publish", "unpublish"] as const;

export type ContentPublicationAction =
  (typeof CONTENT_PUBLICATION_ACTIONS)[number];

/** What one transition does, in the terms a button and a toast both need. */
export interface ContentPublicationTransition {
  /** The route segment and the translation key - they are the same word. */
  action: ContentPublicationAction;
  /** Whether pressing it takes something away from the public site. */
  destructive: boolean;
  /** Where the record ends up. */
  to: ContentPublicationStatus;
}

const PUBLISH: ContentPublicationTransition = {
  action: "publish",
  destructive: false,
  to: "published",
};

const UNPUBLISH: ContentPublicationTransition = {
  action: "unpublish",
  destructive: true,
  to: "draft",
};

/**
 * The transition a record in this state is offered.
 *
 * One of two, always - the lifecycle has no dead end, and a record can be moved
 * back and forth as often as an editor likes. `destructive` is carried with it
 * because it is the same fact stated twice otherwise: unpublishing removes a page
 * from the public site, so the confirmation wears the destructive button, and a
 * host that recomputed that from the status would be free to disagree.
 */
export const contentPublicationTransition = (
  value: unknown,
): ContentPublicationTransition =>
  isContentPublished(value) ? UNPUBLISH : PUBLISH;

/**
 * Whether this content type has a publication lifecycle at all.
 *
 * Without it there is no `status` column, no publish route and nothing for a
 * button to do - so the control is absent rather than disabled, in both AdminCPs.
 */
export const hasContentPublication = (
  definition: AnyContentTypeDefinition,
): boolean => definition.publication.enabled;
