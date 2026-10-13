import type { AnyContentContainerDefinition } from "../containers/types";
import type { ContentLabelTranslator } from "./labels";

import { contentEntityKey, humanizeFieldName } from "./labels";

export type ContentContainerLabelSubject = Pick<
  AnyContentContainerDefinition,
  "id"
>;

/** `/admin/containers/{admin.path}` - where a collection's tree is managed. */
export const contentContainerAdminHref = (
  definition: Pick<AnyContentContainerDefinition, "admin">,
): string => `/admin/containers/${definition.admin.path}`;

/**
 * The i18n keys the AdminCP looks up for a container collection, all under the
 * owning plugin's namespace: `{pluginId}.containers.{entity}`. A sibling of
 * `content`, so a collection and a content type may share an entity name.
 */
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
    /** `"{count, plural, one {Board} other {Boards}}"` - see `contentI18nKeys`. */
    label: `${base}.label`,
    title: `${base}.title`,
  };
};

/** The namespace a collection's own strings live in - what a screen loads. */
export const contentContainerNamespace = (
  definition: ContentContainerLabelSubject,
  pluginId: string,
): string => contentContainerI18nKeys(definition, pluginId).base;

/**
 * A collection's noun and its screen's heading, in the reader's language - the
 * same fallback chain `contentNouns` gives a content type, ending at the name
 * derived from the id (`example.boards` -> "Boards").
 */
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
