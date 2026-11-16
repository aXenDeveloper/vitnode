import type {
  AnyContentTypeDefinition,
  ContentContainerField,
  ContentFieldDescriptor,
} from "../types";
import type { AnyContentContainerDefinition } from "./types";

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

export type ContentContainerSource =
  | {
      container: AnyContentContainerDefinition;
      field: ContentContainerField;
      kind: "field";
      name: string;
    }
  | {
      container: AnyContentContainerDefinition | null;
      kind: "relation";
      name: string;
      target: AnyContentTypeDefinition | null;
    };

const isContainerRelation = (field: ContentFieldDescriptor): boolean =>
  field.kind === "relation" &&
  (field as { container?: boolean }).container === true &&
  !field.multiple;

const relationTargetOf = (
  field: ContentFieldDescriptor,
): AnyContentTypeDefinition | null => {
  if (field.kind !== "relation") return null;
  try {
    return field.target() ?? null;
  } catch {
    return null;
  }
};

/**
 * Where a content type's container comes from: its own `field.container()`, or
 * a to-one `field.relation({ container: true })` whose target is filed in one.
 */
export const contentContainerSourceOf = (
  definition: Pick<AnyContentTypeDefinition, "fields">,
): ContentContainerSource | null => {
  const own = contentContainerFieldOf(definition);
  if (own) {
    return {
      container: own.field.definition,
      field: own.field,
      kind: "field",
      name: own.name,
    };
  }

  for (const [name, field] of Object.entries(definition.fields)) {
    if (!isContainerRelation(field)) continue;
    const target = relationTargetOf(field);

    return {
      container: target
        ? (contentContainerFieldOf(target)?.field.definition ?? null)
        : null,
      kind: "relation",
      name,
      target,
    };
  }

  return null;
};
