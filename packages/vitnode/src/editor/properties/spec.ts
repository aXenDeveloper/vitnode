import type {
  AnyBlockDefinition,
  BlockUnknownData,
  RegisteredBlock,
} from "../../blocks/types";
import type {
  ContentFormFieldSpec,
  ContentFormSpec,
} from "../../content/admin/spec";

import { humanizeFieldName } from "../../content/admin/labels";
import { projectFormField } from "../../content/admin/spec";
import { CONTENT_PATH_SEPARATOR } from "../../content/const";

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

const EMPTY_UNSETS: ReadonlySet<ContentFormFieldSpec["kind"]> = new Set([
  "dateTime",
  "slug",
]);

export const clearsBlockField = (
  specs: readonly ContentFormFieldSpec[],
  name: string,
  value: unknown,
): boolean => {
  const spec = specs.find(item => item.name === name);
  if (!spec || spec.required || spec.nullable || !EMPTY_UNSETS.has(spec.kind)) {
    return false;
  }

  return value === "" || value === null || value === undefined;
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
