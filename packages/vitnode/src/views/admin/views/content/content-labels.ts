import type { ContentLabelTranslator } from "@/content/admin/labels";
import type { RegisteredFrontendContentType } from "@/content/admin/registry";

import {
  contentI18nKeys,
  contentNouns,
  humanizeFieldName,
} from "@/content/admin/labels";

export interface ContentLabels {
  desc: string | undefined;
  labelEnum: (field: string, value: string) => string;
  labelField: (name: string) => string;
  labelSection: (name: string) => { desc: string | undefined; title: string };
  plural: string;
  singular: string;
  title: string;
}

export type ContentRouteLabels = Pick<
  ContentLabels,
  "desc" | "plural" | "singular" | "title"
>;

/** {@link ContentLabels}, narrowed to what a loader may return. */
export const contentRouteLabels = ({
  desc,
  plural,
  singular,
  title,
}: ContentLabels): ContentRouteLabels => ({ desc, plural, singular, title });

export const contentLabelsFrom = (
  entry: Pick<RegisteredFrontendContentType, "definition" | "pluginId">,
  t: ContentLabelTranslator,
): ContentLabels => {
  const { definition, pluginId } = entry;
  const keys = contentI18nKeys(definition, pluginId);

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
    labelSection: name => {
      const section = keys.section(name);

      return {
        desc: t.has(section.desc) ? t(section.desc) : undefined,
        title: t.has(section.title)
          ? t(section.title)
          : humanizeFieldName(name),
      };
    },
    ...contentNouns(definition, pluginId, t),
  };
};

export const contentRouteNamespaces = (pluginId: string): string[] => [
  "core.global",
  "core.content",
  pluginId,
];
