"use client";

import React from "react";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormSpec } from "@/content/admin/spec";
import type { ContentFormLayout } from "@/lib/plugin";

import { useRouter } from "@/lib/navigation";

import { ContentForm } from "../actions/content-form";
import { LocaleEditor } from "../actions/translations/locale-editor";

export interface ContentFormPageProps {
  /** Where Cancel goes, and where a create lands when there is no edit page. */
  backHref: string;
  /**
   * Where a successful create goes: the new record's edit page when the content
   * type has one, and the list when it does not.
   *
   * A template rather than a callback, because this component is rendered from a
   * server one - `{id}` is substituted with the identifier the mutation returned.
   */
  createdHrefTemplate?: string;
  /** Existing values when editing; absent when creating. */
  data?: Record<string, unknown> & { id: number };
  /** The content type's default locale. Set when `translationSpec` is. */
  defaultLocale?: string;
  editorial?: boolean;
  fieldOverrides?: Record<
    string,
    (props: ItemAutoFormComponentProps) => React.ReactNode
  >;
  layout?: ContentFormLayout;
  permissionModule: string;
  pluginId: string;
  publication?: boolean;
  singular: string;
  spec: ContentFormSpec;
  title?: string;
  /** Localized-field form spec, or `null` when the content type is not localized. */
  translationSpec?: ContentFormSpec | null;
}

/**
 * The client half of a generated create/edit **page**.
 *
 * Renders exactly what the dialog renders - the same `ContentForm`, the same
 * `LocaleEditor` for a localized content type - so page mode is a change of
 * where the form is, not of what it does. Every mutation, precondition, toast
 * and invalidation still comes from the Content Engine.
 */
export const ContentFormPage = ({
  backHref,
  createdHrefTemplate,
  data,
  defaultLocale,
  editorial = false,
  permissionModule,
  pluginId,
  translationSpec = null,
  ...props
}: ContentFormPageProps) => {
  const { push } = useRouter();

  const onCreated = (id: number) => {
    push(
      createdHrefTemplate
        ? createdHrefTemplate.replace("{id}", String(id))
        : backHref,
    );
  };

  const form = { ...props, data, onCreated, presentation: "page" as const };

  // A localized record is edited one language at a time, and the tab strip needs
  // a record to exist first - so a create page writes the shared fields, then
  // hands over to the edit page where the locales live.
  if (translationSpec && data) {
    return (
      <LocaleEditor
        defaultLocale={defaultLocale ?? ""}
        editorial={editorial}
        permissionModule={permissionModule}
        pluginId={pluginId}
        translationSpec={translationSpec}
        {...form}
      />
    );
  }

  return <ContentForm {...form} />;
};
