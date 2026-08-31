"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { createTranslator } from "use-intl";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentLabelTranslator } from "@/content/admin/labels";
import type { ContentFormSpec } from "@/content/admin/spec";
import type { RegisteredFrontendContentType } from "@/content/index";
import type { ContentLabels } from "@/views/admin/views/content/content-labels";

import { buildContentFormSpec } from "@/content/admin/spec";
import {
  contentLabelsFrom,
  contentRouteNamespaces,
} from "@/views/admin/views/content/content-labels";

import { useLocale } from "../../../i18n/locale";
import { intlQueryOptions } from "../../../i18n/query";

/**
 * One content type's form, as the browser has to build it.
 *
 * The Next.js AdminCP builds the spec in a Server Component and hands it to the
 * form as a prop, already translated. There is no server component here, so it
 * is built where the strings are - and the whole of the difficulty is making it
 * *stable*, because a spec with a fresh identity on every render would rebuild
 * the Zod schema on every render, and `AutoForm` would be handed a new schema
 * while somebody is typing into it.
 *
 * So the messages come from the query entry the route's loader already warmed
 * rather than from `useTranslations()`. A query result is one object for the
 * life of the entry, which makes `[entry, locale, messages]` a dependency list
 * that only changes when the answer really does - a different content type, or
 * the administrator switching language.
 *
 * ## The namespaces must match the loader's
 *
 * `contentRouteNamespaces(pluginId)` is the same call `loadContentAdminRoute`
 * makes, so `useSuspenseQuery` reads the entry that is already there and nothing
 * suspends on the first paint. Warming a different pair would cost a round trip
 * *and* render the form with a second copy of the strings.
 */

/** A content type's form spec, its labels, and its plugin's overrides. */
export interface ContentTypeForm {
  fieldOverrides: Record<
    string,
    (props: ItemAutoFormComponentProps) => React.ReactNode
  >;
  labels: ContentLabels;
  spec: ContentFormSpec;
}

/** The plugin's field overrides, as `ContentForm` takes them. */
const fieldOverridesOf = (entry: RegisteredFrontendContentType) =>
  Object.fromEntries(
    Object.entries(entry.registration.fields ?? {}).map(([name, override]) => [
      name,
      override.component,
    ]),
  );

export const useContentTypeForm = (
  entry: RegisteredFrontendContentType,
): ContentTypeForm => {
  const locale = useLocale();
  const { data } = useSuspenseQuery(
    intlQueryOptions({
      locale,
      namespaces: contentRouteNamespaces(entry.pluginId),
    }),
  );
  const messages = data.messages;

  return React.useMemo(() => {
    /**
     * A translator over the whole warmed record rather than a namespaced one,
     * for the reason `loadContentAdminRoute` gives at length: every label key is
     * assembled at runtime from the content type id and spans both namespaces,
     * which a namespaced translator could not reach.
     */
    const t = createTranslator({
      locale,
      messages,
      onError: () => {
        // A missing key is the expected case - every label is optional and the
        // resolver falls back to a humanised field name. Left unhandled,
        // `use-intl` logs one console error per absent translation.
      },
    }) as unknown as ContentLabelTranslator;

    const labels = contentLabelsFrom(entry, t);

    return {
      fieldOverrides: fieldOverridesOf(entry),
      labels,
      spec: buildContentFormSpec({
        definition: entry.definition,
        labelEnum: labels.labelEnum,
        labelField: labels.labelField,
        labelSection: labels.labelSection,
        pluginId: entry.pluginId,
      }),
    };
  }, [entry, locale, messages]);
};
