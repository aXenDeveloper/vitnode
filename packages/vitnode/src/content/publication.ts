import type {
  AnyContentTypeDefinition,
  ContentPublicationStatus,
} from "./types";

import { isContentPublicationStatus } from "./const";

export const CONTENT_DEFAULT_PUBLICATION_STATUS: ContentPublicationStatus =
  "draft";

export type { ContentPublicationStatus };

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

export const contentPublicationTransition = (
  value: unknown,
): ContentPublicationTransition =>
  isContentPublished(value) ? UNPUBLISH : PUBLISH;

export const hasContentPublication = (
  definition: AnyContentTypeDefinition,
): boolean => definition.publication.enabled;
