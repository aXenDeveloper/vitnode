import type z from "zod";

import type {
  AnyBlockDefinition,
  BlockUnknownData,
  RegisteredBlock,
} from "../../blocks/types";
import type {
  ContentFormFieldSpec,
  ContentFormSpec,
} from "../../content/admin/spec";
import type { ContentFieldDescriptor } from "../../content/types";

import { humanizeFieldName } from "../../content/admin/labels";
import { projectFormField } from "../../content/admin/spec";
import { CONTENT_PATH_SEPARATOR } from "../../content/const";
import { contentInnerFields } from "../../content/paths";
import { contentFieldValuesObject } from "../../content/schemas";

const labelForPath = (path: string): string => {
  const leaf = path.split(CONTENT_PATH_SEPARATOR).at(-1) ?? path;

  return humanizeFieldName(leaf);
};

const labelForValue = (_name: string, value: string): string =>
  humanizeFieldName(value);

export const blockFieldSpecs = (
  definition: AnyBlockDefinition,
): ContentFormFieldSpec[] =>
  Object.entries(definition.fields).map(([name, fieldValue]) =>
    projectFormField(name, fieldValue, labelForValue, labelForPath),
  );

export const blockFormSpec = (entry: RegisteredBlock): ContentFormSpec => ({
  contentTypeId: entry.type,
  defaultLocale: null,
  fields: blockFieldSpecs(entry.definition),
  permissionModule: entry.pluginId,
  pluginId: entry.pluginId,
  sections: [],
  titleField: null,
});

export const blockDisplayName = (entry: RegisteredBlock): string =>
  entry.definition.name ?? humanizeFieldName(entry.definition.id);

const isCleared = (value: unknown): boolean =>
  value === "" || value === null || value === undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const storedSchemas = new WeakMap<ContentFieldDescriptor, z.ZodType>();

const storedFieldSchema = (fieldValue: ContentFieldDescriptor): z.ZodType => {
  const cached = storedSchemas.get(fieldValue);
  if (cached) return cached;

  const built = contentFieldValuesObject({ value: fieldValue }).shape
    .value as z.ZodType;
  storedSchemas.set(fieldValue, built);

  return built;
};

const clearsField = (
  fieldValue: ContentFieldDescriptor,
  value: unknown,
): boolean => {
  if (fieldValue.required || fieldValue.nullable) return false;
  if (!isCleared(value)) return false;
  if (value === undefined) return true;

  return !storedFieldSchema(fieldValue).safeParse(value).success;
};

export const clearsBlockField = (
  definition: AnyBlockDefinition,
  name: string,
  value: unknown,
): boolean => {
  const fieldValue: ContentFieldDescriptor | undefined =
    definition.fields[name];

  return fieldValue !== undefined && clearsField(fieldValue, value);
};

export const normalizeBlockFieldValue = (
  fieldValue: ContentFieldDescriptor | undefined,
  value: unknown,
): unknown => {
  const inner = fieldValue === undefined ? {} : contentInnerFields(fieldValue);
  if (Object.keys(inner).length === 0) return value;

  if (Array.isArray(value)) {
    return value.map(row => normalizeBlockFieldValue(fieldValue, row));
  }
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).flatMap(([name, leafValue]) => {
      const leaf = inner[name];
      if (leaf === undefined) return [[name, leafValue] as const];

      const normalized = normalizeBlockFieldValue(leaf, leafValue);

      return clearsField(leaf, normalized) ? [] : [[name, normalized] as const];
    }),
  );
};

const keyedLikeNormalized = (normalized: unknown, parsed: unknown): unknown => {
  if (!isRecord(normalized) || !isRecord(parsed)) return parsed;

  return Object.fromEntries(
    Object.keys(normalized)
      .filter(name => name in parsed)
      .map(name => [name, keyedLikeNormalized(normalized[name], parsed[name])]),
  );
};

export const blockFieldPatchEntries = (
  definition: AnyBlockDefinition,
  formSchema: z.ZodObject<z.ZodRawShape>,
  name: string,
  value: unknown,
): readonly (readonly [string, unknown])[] => {
  const normalized = normalizeBlockFieldValue(definition.fields[name], value);
  const schema = formSchema.shape[name] as undefined | z.ZodType;
  const parsed = schema?.safeParse(normalized);
  if (parsed?.success !== true) return [];

  return [[name, keyedLikeNormalized(normalized, parsed.data)] as const];
};

export const blockDataFromFormValues = (
  base: BlockUnknownData,
  values: Record<string, unknown>,
): BlockUnknownData => {
  const data: BlockUnknownData = { ...base };

  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined) data[name] = value;
  }

  return data;
};
