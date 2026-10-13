import type { AnyContentTypeDefinition, ContentContainerField } from "../types";

import { ContentInputError } from "../errors";

export interface ContentContainerFieldEntry {
  field: ContentContainerField;
  name: string;
}

export const contentContainerFieldOf = (
  definition: Pick<AnyContentTypeDefinition, "fields">,
): ContentContainerFieldEntry | null => {
  for (const [name, field] of Object.entries(definition.fields)) {
    if (field.kind === "container") return { field, name };
  }

  return null;
};

export type ContentContainerAssignmentCode =
  | "CONTAINER_DEFINITION_MISMATCH"
  | "CONTAINER_NOT_FOUND";

export class ContentContainerAssignmentError extends ContentInputError {
  constructor({
    code,
    contentTypeId,
    field,
  }: {
    code: ContentContainerAssignmentCode;
    contentTypeId: string;
    field: string;
  }) {
    const message =
      code === "CONTAINER_NOT_FOUND"
        ? "The selected container does not exist."
        : "The selected container belongs to a different collection.";
    super(message, { contentTypeId });

    this.name = "ContentContainerAssignmentError";
    this.code = code;
    this.detail = message;
    this.field = field;
  }

  readonly code: ContentContainerAssignmentCode;
  readonly detail: string;
  readonly field: string;
}
