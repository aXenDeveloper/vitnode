"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

import type { ContentPanelProps } from "./content-panel";

import { ContentPanel } from "./content-panel";

// The per-language lifecycle panel pulls in the history reader, so it arrives
// with the dialog rather than with the table.
const TranslationManager = dynamic(async () =>
  import("./translations/translation-manager").then(mod => ({
    default: mod.TranslationManager,
  })),
);

/**
 * The per-language lifecycle action.
 *
 * Translation *values* are edited in the ordinary form, where each localized
 * input has its own language switcher - so this is not an editor. It is where
 * the things that are genuinely about one language and not about one field live:
 * publish, unpublish, history, restore and delete.
 *
 * A dialog rather than a strip of tabs around the form, deliberately: the
 * language is a parameter of *this* action, not a mode the whole screen is in.
 */
export const TranslationsContentPanel = ({
  contentTypeId,
  defaultLocale,
  editorial,
  id,
  permissionModule,
  pluginId,
  publication,
  singular,
  title,
  ...panel
}: ContentPanelProps & {
  contentTypeId: string;
  defaultLocale: string;
  editorial: boolean;
  id: number;
  permissionModule: string;
  pluginId: string;
  publication: boolean;
  singular: string;
  title: string;
}) => {
  const t = useTranslations("core.content.translations");

  return (
    <ContentPanel
      description={title}
      title={t("manage", { name: singular })}
      {...panel}
    >
      <TranslationManager
        contentTypeId={contentTypeId}
        defaultLocale={defaultLocale}
        editorial={editorial}
        itemId={id}
        permissionModule={permissionModule}
        pluginId={pluginId}
        publication={publication}
      />
    </ContentPanel>
  );
};
