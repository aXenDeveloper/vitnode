import React from "react";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormSpec } from "@/content/admin/spec";
import type { ContentId } from "@/content/ids";
import type { ContentFormLayout } from "@/lib/plugin";

import { contentIdKey } from "@/content/ids";

import type { TranslationRow } from "../content-mutation";
import type { ContentFormHeaderValue } from "../form/context";
import type { ContentFormSkeletonOverrides } from "../form/skeleton";

import { ContentForm } from "../actions/content-form";
import { useContentFormNavigation } from "../form/navigation";

export interface ContentFormPageProps {
  backHref: string;
  createdHrefTemplate?: string;
  data?: Record<string, unknown> & { id: ContentId };
  fieldOverrides?: Record<
    string,
    (props: ItemAutoFormComponentProps) => React.ReactNode
  >;
  fieldSkeletons?: ContentFormSkeletonOverrides;
  header: ContentFormHeaderValue;
  layout?: ContentFormLayout;
  publication?: boolean;
  singular: string;
  spec: ContentFormSpec;
  title?: string;
  translations?: readonly TranslationRow[];
  visibility?: boolean;
}

export const ContentFormPage = ({
  backHref,
  createdHrefTemplate,
  data,
  ...props
}: ContentFormPageProps) => {
  const { navigate } = useContentFormNavigation();

  const onCreated = (id: ContentId) => {
    navigate(
      createdHrefTemplate
        ? createdHrefTemplate.replace("{id}", contentIdKey(id))
        : backHref,
    );
  };

  return (
    <ContentForm
      key={`${props.spec.contentTypeId}#${data?.id ?? "new"}`}
      {...props}
      data={data}
      onCreated={onCreated}
      presentation="page"
    />
  );
};
