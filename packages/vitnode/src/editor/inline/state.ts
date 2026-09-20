import type { AnyBlockDefinition, BlockUnknownData } from "../../blocks/types";
import type { ContentFieldDescriptor } from "../../content/types";

import { isContentFieldPath } from "../../content/paths";
import { clearsBlockField } from "../properties/spec";

export type InlineFieldKind = "text" | "textarea";

export interface InlineFieldCommit {
  data: BlockUnknownData;
  remove: readonly string[];
}

export interface InlineFieldSnapshot {
  name: string;
  present: boolean;
  text: string;
  value: unknown;
}

const NOTHING_REMOVED: readonly string[] = [];

export const inlineFieldKind = (
  definition: AnyBlockDefinition | undefined,
  name: string,
): InlineFieldKind | null => {
  if (definition === undefined || isContentFieldPath(name)) return null;

  const fieldValue: ContentFieldDescriptor | undefined =
    definition.fields[name];
  if (fieldValue === undefined) return null;

  return fieldValue.kind === "text" || fieldValue.kind === "textarea"
    ? fieldValue.kind
    : null;
};

export const inlineFieldText = (
  data: BlockUnknownData,
  name: string,
): string => {
  const value = data[name];

  return typeof value === "string" ? value : "";
};

export const inlineFieldCommit = (
  definition: AnyBlockDefinition,
  name: string,
  text: string,
): InlineFieldCommit =>
  clearsBlockField(definition, name, text)
    ? { data: {}, remove: [name] }
    : { data: { [name]: text }, remove: NOTHING_REMOVED };

export const inlineFieldSnapshot = (
  data: BlockUnknownData,
  name: string,
): InlineFieldSnapshot => ({
  name,
  present: Object.hasOwn(data, name),
  text: inlineFieldText(data, name),
  value: data[name],
});

export const inlineFieldRestore = (
  snapshot: InlineFieldSnapshot,
): InlineFieldCommit =>
  snapshot.present
    ? { data: { [snapshot.name]: snapshot.value }, remove: NOTHING_REMOVED }
    : { data: {}, remove: [snapshot.name] };
