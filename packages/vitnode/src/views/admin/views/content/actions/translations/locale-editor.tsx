// No "use client": reached only from `edit-action`, already a client entry.
import { useTranslations } from "next-intl";
import React from "react";

import type { ContentFormSpec } from "@/content/admin/spec";

import { useLanguages } from "@/components/languages-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { ContentFormProps } from "../content-form";
import type { TranslationMeta } from "../translation-api.server";

import { ContentForm } from "../content-form";
import { listContentTranslationsAction } from "../translation-api.server";
import { TranslationPanel } from "./translation-panel";
import {
  translationStateOf,
  TranslationStatusBadge,
} from "./translation-status";

export interface LocaleEditorProps extends ContentFormProps {
  /** The content type's default locale - its translation is never deletable. */
  defaultLocale: string;
  editorial: boolean;
  permissionModule: string;
  pluginId: string;
  /** Localized fields only. `null` for a content type that is not localized. */
  translationSpec: ContentFormSpec;
}

/**
 * The edit surface of a localized content type: `Shared | English | Polski | …`.
 *
 * One tab per language the app serves, plus a first tab for everything that is not
 * per-language. The split is the same one the database makes, which is the point -
 * a field is on the Shared tab exactly when it is a column on the base table.
 *
 * The strip loads **metadata only**, in one request: which locales have a
 * translation and whether each is published. A locale's values are fetched when its
 * tab is opened, so opening the dialog on a record with nine languages costs one
 * query rather than nine.
 *
 * Languages come from the app config through `LanguagesProvider`, which already
 * filters to the enabled ones - so a locale the install has switched off gets no
 * tab, and no way to grow more content in a language nothing renders.
 */
export const LocaleEditor = ({
  defaultLocale,
  editorial,
  permissionModule,
  pluginId,
  translationSpec,
  ...form
}: LocaleEditorProps) => {
  const t = useTranslations("core.content.translations");
  const languages = useLanguages();
  const itemId = form.data?.id ?? 0;

  const [metas, setMetas] = React.useState<TranslationMeta[]>([]);
  const [reloads, setReloads] = React.useState(0);

  /**
   * Loads the strip: one request for every locale's presence and status.
   *
   * Inlined in the effect so nothing writes state before the first `await` - a
   * synchronous write would cost a second render pass every time the dialog opens.
   */
  React.useEffect(() => {
    if (itemId === 0) return;

    let active = true;

    void listContentTranslationsAction(
      translationSpec.contentTypeId,
      itemId,
    ).then(({ edges }) => {
      if (active) setMetas(edges);
    });

    return () => {
      active = false;
    };
  }, [itemId, reloads, translationSpec.contentTypeId]);

  const metaFor = (locale: string): TranslationMeta | undefined =>
    metas.find(meta => meta.locale.toLowerCase() === locale.toLowerCase());

  return (
    <Tabs defaultValue="__shared__">
      {/* Scrolls rather than wraps: an install with a dozen languages must not
          push the form off the bottom of the dialog. */}
      <div className="overflow-x-auto">
        <TabsList>
          <TabsTrigger value="__shared__">{t("shared_tab")}</TabsTrigger>

          {languages.map(language => {
            const meta = metaFor(language.code);

            return (
              <TabsTrigger key={language.code} value={language.code}>
                <span className="flex items-center gap-2">
                  {language.name ?? language.code}
                  <TranslationStatusBadge
                    state={translationStateOf({
                      present: meta !== undefined,
                      status: form.publication
                        ? (meta?.status ?? "draft")
                        : undefined,
                    })}
                  />
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      <TabsContent value="__shared__">
        <ContentForm {...form} />
      </TabsContent>

      {languages.map(language => (
        <TabsContent key={language.code} value={language.code}>
          <TranslationPanel
            contentTypeId={translationSpec.contentTypeId}
            editorial={editorial}
            isDefaultLocale={
              language.code.toLowerCase() === defaultLocale.toLowerCase()
            }
            itemId={itemId}
            languageName={language.name ?? language.code}
            locale={language.code}
            onMutated={() => {
              setReloads(count => count + 1);
            }}
            permissionModule={permissionModule}
            pluginId={pluginId}
            publication={form.publication ?? false}
            spec={translationSpec}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
};
