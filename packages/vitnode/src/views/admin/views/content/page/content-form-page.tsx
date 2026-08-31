"use client";

import React from "react";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormSpec } from "@/content/admin/spec";
import type { ContentFormLayout } from "@/lib/plugin";

import type { TranslationRow } from "../content-mutation";
import type { ContentFormHeaderValue } from "../form/context";

import { ContentForm } from "../actions/content-form";
import { useContentFormNavigation } from "../form/navigation";

export interface ContentFormPageProps {
  backHref: string;
  createdHrefTemplate?: string;
  data?: Record<string, unknown> & { id: number };
  fieldOverrides?: Record<
    string,
    (props: ItemAutoFormComponentProps) => React.ReactNode
  >;
  header: ContentFormHeaderValue;
  layout?: ContentFormLayout;
  publication?: boolean;
  singular: string;
  spec: ContentFormSpec;
  title?: string;
  translations?: readonly TranslationRow[];
}

export const ContentFormPage = ({
  backHref,
  createdHrefTemplate,
  data,
  ...props
}: ContentFormPageProps) => {
  const { navigate } = useContentFormNavigation();

  const onCreated = (id: number) => {
    navigate(
      createdHrefTemplate
        ? createdHrefTemplate.replace("{id}", String(id))
        : backHref,
    );
  };

  return (
    <ContentForm
      /**
       * What the form is editing, as a key.
       *
       * It was the pathname until Stage 13, which is the same fact spelled in
       * one framework's terms: a content form page's URL *is* its content type
       * plus its action plus its record. Spelling it from the spec instead
       * remounts on exactly the same transitions - a different record, a
       * different content type, create becoming edit - under a router with no
       * `usePathname`, and without a pathname the form otherwise has no use for.
       */
      key={`${props.spec.contentTypeId}#${data?.id ?? "new"}`}
      {...props}
      data={data}
      onCreated={onCreated}
      presentation="page"
    />
  );
};
