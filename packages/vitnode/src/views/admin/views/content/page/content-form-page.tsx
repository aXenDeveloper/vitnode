"use client";

import React from "react";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormSpec } from "@/content/admin/spec";
import type { ContentFormLayout } from "@/lib/plugin";

import { usePathname, useRouter } from "@/lib/navigation";

import type { TranslationRow } from "../actions/translation-api.server";
import type { ContentFormHeaderValue } from "../form/context";

import { ContentForm } from "../actions/content-form";

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
  fieldOverrides?: Record<
    string,
    (props: ItemAutoFormComponentProps) => React.ReactNode
  >;
  /**
   * The heading, its description and the back link. Rendered inside the form
   * rather than above it, so a layout can seat the submit buttons beside the
   * back link - see `ContentFormHeader`.
   */
  header: ContentFormHeaderValue;
  layout?: ContentFormLayout;
  publication?: boolean;
  singular: string;
  spec: ContentFormSpec;
  title?: string;
  /**
   * Every translation the record already has, read by the server component
   * above - so the form opens with every language in hand and no second request.
   */
  translations?: readonly TranslationRow[];
}

/**
 * The client half of a generated create/edit **page**.
 *
 * Renders exactly what the dialog renders - one `ContentForm`, localized or not
 * - so page mode is a change of where the form is, not of what it does. Every
 * mutation, precondition, toast and invalidation still comes from the Content
 * Engine.
 */
export const ContentFormPage = ({
  backHref,
  createdHrefTemplate,
  data,
  ...props
}: ContentFormPageProps) => {
  const { push } = useRouter();
  const pathname = usePathname();

  const onCreated = (id: number) => {
    push(
      createdHrefTemplate
        ? createdHrefTemplate.replace("{id}", String(id))
        : backHref,
    );
  };

  return (
    <ContentForm
      key={`${pathname}#${data?.id ?? "new"}`}
      {...props}
      data={data}
      onCreated={onCreated}
      presentation="page"
    />
  );
};
