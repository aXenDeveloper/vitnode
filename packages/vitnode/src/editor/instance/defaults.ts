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

import { createBlockInstance } from "../../blocks/instance";
import { getDefaultBlockRegistry } from "../../blocks/registry";
import { blockDataShapeIssue } from "../../blocks/shape";
import { blockVariants, resolveBlockVariant } from "../../blocks/variant";
import { humanizeFieldName } from "../../content/admin/labels";
import { contentInnerFields } from "../../content/paths";

const ABSENT = Symbol("absent");

const numberDefault = (fieldValue: ContentNumberField): number => {
  if (fieldValue.min !== undefined) {
    return fieldValue.integer ? Math.ceil(fieldValue.min) : fieldValue.min;
  }

  if (fieldValue.max !== undefined && fieldValue.max < 0) {
    return fieldValue.integer ? Math.floor(fieldValue.max) : fieldValue.max;
  }

  return 0;
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

export const createBlockInstanceFor = (
  entry: RegisteredBlock,
): AnyBlockInstance =>
  createBlockInstance(
    entry.type,
    blockDataDefaults(entry.definition.fields),
    entry.definition.defaultVariant,
  );

export const blockInstanceIssue = (
  registry: BlockRegistry | undefined,
  instance: AnyBlockInstance,
): null | string => {
  const resolved = registry ?? getDefaultBlockRegistry();
  if (!resolved) return null;

  const entry = resolved.get(instance.type);
  if (!entry) {
    return `"${instance.type}" is not a registered block type. The plugin that owns it is either not installed or no longer registers it.`;
  }

  const resolution = resolveBlockVariant(entry.definition, instance.variant);
  if (resolution.kind === "unknown") {
    const declared = blockVariants(entry.definition);

    return declared.length === 0
      ? `"${resolution.variant}" is not a layout this block offers - it has none, so it always renders the one way.`
      : `"${resolution.variant}" is not a layout this block offers. It offers ${declared.map(variant => `"${variant.id}"`).join(", ")}.`;
  }

  return blockDataShapeIssue(entry.definition, instance.data);
};
