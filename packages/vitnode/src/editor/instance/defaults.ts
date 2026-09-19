import type {
  AnyBlockInstance,
  BlockRegistry,
  BlockUnknownData,
  RegisteredBlock,
} from "../../blocks/types";
import type {
  ContentFieldDescriptor,
  ContentFieldMap,
  ContentNumberField,
  ContentTextareaField,
  ContentTextField,
} from "../../content/types";
import type { StoredBlockIssue } from "../block-shell/issue";

import { createBlockInstance } from "../../blocks/instance";
import { getDefaultBlockRegistry } from "../../blocks/registry";
import { blockVariants } from "../../blocks/variant";
import { humanizeFieldName } from "../../content/admin/labels";
import { contentInnerFields } from "../../content/paths";
import { checkStoredBlock } from "../block-shell/issue";

const ABSENT = Symbol("absent");

const numberDefault = ({ integer, max, min }: ContentNumberField): number => {
  if (min !== undefined) return integer ? Math.ceil(min) : min;
  if (max === undefined) return 0;

  return Math.min(0, integer ? Math.floor(max) : max);
};

const placeholderText = (
  name: string,
  fieldValue: ContentTextareaField | ContentTextField,
): string => {
  const base = humanizeFieldName(name).trim();
  const seed = base === "" ? "Text" : base;
  let text = seed;

  const { maxLength, minLength } = fieldValue;

  while (minLength !== undefined && text.length < minLength) {
    text = `${text} ${seed}`;
  }

  return maxLength !== undefined && text.length > maxLength
    ? text.slice(0, maxLength)
    : text;
};

const defaultValueFor = (
  name: string,
  fieldValue: ContentFieldDescriptor,
): unknown => {
  switch (fieldValue.kind) {
    case "boolean":
      return fieldValue.defaultValue ?? false;

    case "dateTime":
      if (fieldValue.defaultNow) return new Date().toISOString();
      if (fieldValue.nullable) return null;

      return fieldValue.required ? new Date().toISOString() : ABSENT;

    case "enum":
      return fieldValue.defaultValue ?? fieldValue.values[0];

    case "group":
      return blockDataDefaults(contentInnerFields(fieldValue));

    case "number":
      return fieldValue.defaultValue ?? numberDefault(fieldValue);

    case "text":
    case "textarea":
      if (fieldValue.defaultValue !== undefined) return fieldValue.defaultValue;
      if (fieldValue.nullable) return null;

      return fieldValue.required ? placeholderText(name, fieldValue) : ABSENT;

    default:
      return fieldValue.nullable ? null : ABSENT;
  }
};

const blockDataDefaults = (fields: ContentFieldMap): BlockUnknownData =>
  Object.fromEntries(
    Object.entries(fields)
      .map(([name, fieldValue]) => [name, defaultValueFor(name, fieldValue)])
      .filter(([, value]) => value !== ABSENT),
  );

export const groupDefaults = (
  fieldValue: ContentFieldDescriptor,
): BlockUnknownData => blockDataDefaults(contentInnerFields(fieldValue));

export const createBlockInstanceFor = (
  entry: RegisteredBlock,
): AnyBlockInstance =>
  createBlockInstance(
    entry.type,
    blockDataDefaults(entry.definition.fields),
    entry.definition.defaultVariant,
  );

const storedBlockIssueDetail = (
  entry: RegisteredBlock | undefined,
  instance: AnyBlockInstance,
  issue: StoredBlockIssue,
): string => {
  if (issue.kind === "invalid-data") return issue.detail;

  if (issue.kind === "unknown-type") {
    return `"${instance.type}" is not a registered block type. The plugin that owns it is either not installed or no longer registers it.`;
  }

  const declared = entry === undefined ? [] : blockVariants(entry.definition);

  return declared.length === 0
    ? `"${issue.variant}" is not a layout this block offers - it has none, so it always renders the one way.`
    : `"${issue.variant}" is not a layout this block offers. It offers ${declared.map(variant => `"${variant.id}"`).join(", ")}.`;
};

export const blockInstanceIssue = (
  registry: BlockRegistry | undefined,
  instance: AnyBlockInstance,
): null | string => {
  const resolved = registry ?? getDefaultBlockRegistry();
  if (!resolved) return null;

  const entry = resolved.get(instance.type);
  const checked = checkStoredBlock(entry, instance);

  return checked.kind === "ready"
    ? null
    : storedBlockIssueDetail(entry, instance, checked.issue);
};
