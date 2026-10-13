import type { AnyContentContainerDefinition } from "../containers/types";
import type { ContentLabelTranslator } from "./labels";

import { contentEntityKey, humanizeFieldName } from "./labels";

type ContentContainerLabelSubject = Pick<AnyContentContainerDefinition, "id">;

export const contentContainerAdminHref = (
  definition: Pick<AnyContentContainerDefinition, "admin">,
): string => `/admin/containers/${definition.admin.path}`;

export const contentContainerI18nKeys = (
  definition: ContentContainerLabelSubject,
  pluginId: string,
) => {
  const base = `${pluginId}.containers.${contentEntityKey(definition.id)}`;

  return {
    base,
    desc: `${base}.desc`,
    enumValue: (field: string, value: string) =>
      `${base}.enums.${field}.${value}`,
    field: (field: string) => `${base}.fields.${field}`,
    label: `${base}.label`,
    title: `${base}.title`,
  };
};

export const contentContainerNamespace = (
  definition: ContentContainerLabelSubject,
  pluginId: string,
): string => contentContainerI18nKeys(definition, pluginId).base;

export const contentContainerNouns = (
  definition: ContentContainerLabelSubject,
  pluginId: string,
  t: ContentLabelTranslator,
): { plural: string; singular: string; title: string } => {
  const keys = contentContainerI18nKeys(definition, pluginId);
  const fallback = humanizeFieldName(contentEntityKey(definition.id));
  const noun = (count: number): string =>
    t.has(keys.label) ? t(keys.label, { count }) : fallback;
  const plural = noun(2);

  return {
    plural,
    singular: noun(1),
    title: t.has(keys.title) ? t(keys.title) : plural,
  };
};

export interface ContentContainerLabels {
  desc: string | undefined;
  labelEnum: (field: string, value: string) => string;
  labelField: (name: string) => string;
  plural: string;
  singular: string;
  title: string;
}

export const contentContainerLabelsFrom = (
  definition: ContentContainerLabelSubject,
  pluginId: string,
  t: ContentLabelTranslator,
): ContentContainerLabels => {
  const keys = contentContainerI18nKeys(definition, pluginId);

  return {
    desc: t.has(keys.desc) ? t(keys.desc) : undefined,
    labelEnum: (field, value) => {
      const key = keys.enumValue(field, value);

      return t.has(key) ? t(key) : humanizeFieldName(value);
    },
    labelField: name => {
      const key = keys.field(name);

      return t.has(key) ? t(key) : humanizeFieldName(name);
    },
    ...contentContainerNouns(definition, pluginId, t),
  };
};
