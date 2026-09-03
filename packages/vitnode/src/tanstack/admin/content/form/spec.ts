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
