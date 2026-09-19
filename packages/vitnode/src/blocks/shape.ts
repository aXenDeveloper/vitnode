import type { ContentFieldDescriptor } from "../content/types";
import type { AnyBlockDefinition } from "./types";

import { contentInnerFields } from "../content/paths";

const typeOfKind = (kind: string): string => {
  switch (kind) {
    case "boolean":
      return "boolean";
    case "group":
      return "object";
    case "number":
      return "number";
    default:
      return "string";
  }
};

const mismatch = (
  fieldValue: ContentFieldDescriptor,
  value: unknown,
): boolean => {
  const expected = typeOfKind(fieldValue.kind);

  if (expected === "object") {
    return typeof value !== "object" || Array.isArray(value);
  }

  return typeof value !== expected;
};

const leafIssue = (
  path: string,
  fieldValue: ContentFieldDescriptor,
  value: unknown,
): null | string => {
  if (value === undefined) {
    return fieldValue.required ? `"${path}" is required and absent` : null;
  }

  if (value === null) {
    return fieldValue.nullable ? null : `"${path}" is null and not nullable`;
  }

  if (mismatch(fieldValue, value)) {
    return `"${path}" holds a ${Array.isArray(value) ? "array" : typeof value} where the field is a ${fieldValue.kind}`;
  }

  if (
    fieldValue.kind === "enum" &&
    typeof value === "string" &&
    !fieldValue.values.includes(value)
  ) {
    return `"${path}" holds ${JSON.stringify(value)}, which the field no longer lists among its values`;
  }

  return null;
};

export const blockDataShapeIssue = (
  definition: AnyBlockDefinition,
  data: Record<string, unknown>,
): null | string => {
  for (const key of Object.keys(data)) {
    if (!(key in definition.fields)) {
      return `"${key}" is not a field of this block`;
    }
  }

  for (const [name, fieldValue] of Object.entries(definition.fields)) {
    const value = data[name];
    const issue = leafIssue(name, fieldValue, value);
    if (issue !== null) return issue;

    if (fieldValue.kind !== "group" || value === undefined || value === null) {
      continue;
    }

    const inner = contentInnerFields(fieldValue);
    const nested = value as Record<string, unknown>;

    for (const key of Object.keys(nested)) {
      if (!(key in inner))
        return `"${name}.${key}" is not a leaf of this group`;
    }

    for (const [leaf, leafValue] of Object.entries(inner)) {
      const nestedIssue = leafIssue(`${name}.${leaf}`, leafValue, nested[leaf]);
      if (nestedIssue !== null) return nestedIssue;
    }
  }

  return null;
};
