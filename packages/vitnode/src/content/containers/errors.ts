import type { ContentContainerErrorCode } from "./types";

import { ContentEngineError } from "../errors";

const MESSAGES: Record<ContentContainerErrorCode, string> = {
  cycle: "A container cannot be moved inside itself or one of its descendants.",
  definitionMismatch:
    "The container belongs to a different container collection.",
  hasChildren:
    "The container still has child containers. Move or delete them first.",
  hasContent:
    "The container still holds content. Move or delete that content first.",
  invalidInput: "The request does not describe a valid container.",
  invalidMetadata: "The container's values do not match its definition.",
  invalidPosition: "The position is outside the list of siblings.",
  limitReached: "This collection already holds as many containers as it can.",
  maxDepth: "The container would be nested deeper than this collection allows.",
  notFound: "The container does not exist.",
  parentNotFound: "The parent container does not exist.",
  slugEmpty: "The slug has no letters or digits left once it is normalised.",
  slugTaken: "Another container in this collection already uses that slug.",
};

const STATUS: Record<ContentContainerErrorCode, 400 | 404 | 409> = {
  cycle: 400,
  definitionMismatch: 400,
  hasChildren: 409,
  hasContent: 409,
  invalidInput: 400,
  invalidMetadata: 400,
  invalidPosition: 400,
  limitReached: 409,
  maxDepth: 400,
  notFound: 404,
  parentNotFound: 400,
  slugEmpty: 400,
  slugTaken: 409,
};

/**
 * A container write the tree rules refuse. Per-request, like
 * `ContentInputError`: the message is safe to show, and `code` is what the
 * AdminCP translates.
 */
export class ContentContainerError extends ContentEngineError {
  constructor({
    code,
    definitionId,
    message,
  }: {
    code: ContentContainerErrorCode;
    definitionId: string;
    message?: string;
  }) {
    super(message ?? MESSAGES[code], { contentTypeId: definitionId });

    this.name = "ContentContainerError";
    this.code = code;
    this.detail = message ?? MESSAGES[code];
    this.status = STATUS[code];
  }

  readonly code: ContentContainerErrorCode;
  readonly detail: string;
  readonly status: 400 | 404 | 409;
}
