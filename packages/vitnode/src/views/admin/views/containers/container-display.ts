import type { AnyContentContainerDefinition } from "@vitnode/api/content/containers/types";

import { contentContainerIconFields } from "@vitnode/api/content/containers/icon";
import { contentLocalesMatch } from "@vitnode/api/content/locale";

import type { AdminContentContainer } from "./container-request";

export const containerLabel = (
  record: Pick<AdminContentContainer, "label" | "name">,
): string => record.label ?? record.name;

export const decorateContainers = (
  records: readonly AdminContentContainer[],
  {
    definition,
    locale,
  }: { definition: AnyContentContainerDefinition; locale: string },
): AdminContentContainer[] => {
  const [iconField] = contentContainerIconFields(definition)[0] ?? [];
  const { defaultLocale, enabled } = definition.localization;
  const translated = enabled && !contentLocalesMatch(locale, defaultLocale);

  return records.map(record => {
    const translation = translated
      ? Object.entries(record.translations).find(([code]) =>
          contentLocalesMatch(code, locale),
        )?.[1]
      : undefined;
    const glyph = iconField === undefined ? null : record.metadata[iconField];

    return {
      ...record,
      glyph: typeof glyph === "string" && glyph !== "" ? glyph : null,
      label: translation?.name ?? record.name,
    };
  });
};
