import React from "react";

import type { ContentFormSpec } from "@/content/admin/spec";
import type { AnyContentTypeDefinition } from "@/content/types";
import type { ContentFormLayout } from "@/lib/plugin";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { ContentFormHeaderValue } from "./context";

import { ContentFormProvider } from "./context";
import { ContentFormHeader, ContentFormSection } from "./layout-primitives";
import { useContentFormNavigation } from "./navigation";

export type ContentFormSkeletonControl =
  "editor" | "input" | "list" | "media" | "switch" | "textarea";

interface ContentFormSkeletonField {
  control: ContentFormSkeletonControl;
  name: string;
}

interface ContentFormSkeletonSection {
  fields: readonly string[];
  name: string;
}

export interface ContentFormSkeletonShape {
  fields: readonly ContentFormSkeletonField[];
  sections: readonly ContentFormSkeletonSection[];
}

interface SkeletonFieldSource {
  kind: string;
  multiple?: boolean;
}

const controlOfKind: Record<string, ContentFormSkeletonControl> = {
  boolean: "switch",
  dateTime: "input",
  enum: "input",
  file: "media",
  group: "list",
  number: "input",
  relation: "input",
  repeatable: "list",
  slug: "input",
  text: "input",
  textarea: "textarea",
  user: "input",
};

const contentSkeletonControlOf = (
  field: SkeletonFieldSource,
): ContentFormSkeletonControl => {
  const toMany =
    field.multiple === true &&
    (field.kind === "relation" || field.kind === "user");

  return toMany ? "list" : (controlOfKind[field.kind] ?? "input");
};

const controlClassName: Record<ContentFormSkeletonControl, string> = {
  editor: "h-64",
  input: "h-9",
  list: "h-20",
  media: "h-32",
  switch: "h-5 w-9 rounded-full",
  textarea: "h-24",
};

export const ContentFormFieldSkeleton = ({
  control,
}: {
  control: ContentFormSkeletonControl;
}) => {
  if (control === "switch") {
    return (
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className={controlClassName.switch} />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <Skeleton className="h-4 w-28" />

      {control === "editor" ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className={cn(controlClassName.editor, "w-full")} />
        </div>
      ) : (
        <Skeleton className={cn(controlClassName[control], "w-full")} />
      )}
    </div>
  );
};

export const ContentFormButtonSkeleton = () => (
  <Skeleton className="h-9 w-28" />
);

export const ContentFormStatusSkeleton = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Skeleton className="h-4 w-14" />
    <Skeleton className="h-5 w-20 rounded-full" />
    <Skeleton className="h-4 w-28" />
  </div>
);

export const contentFormSkeletonShape = ({
  definition,
  overrides,
}: {
  definition: AnyContentTypeDefinition;
  overrides?: ContentFormSkeletonOverrides;
}): ContentFormSkeletonShape => ({
  fields: definition.admin.form.fields.map(name => ({
    control:
      overrides?.[name] ?? contentSkeletonControlOf(definition.fields[name]),
    name,
  })),
  sections: definition.admin.form.sections.map(({ fields, name }) => ({
    fields,
    name,
  })),
});

export type ContentFormSkeletonOverrides = Record<
  string,
  ContentFormSkeletonControl | undefined
>;

export const contentFieldSkeletonOverrides = (
  fields: Record<string, { skeleton?: ContentFormSkeletonControl }> | undefined,
): ContentFormSkeletonOverrides =>
  Object.fromEntries(
    Object.entries(fields ?? {}).map(([name, field]) => [name, field.skeleton]),
  );

export const contentSpecSkeletonShape = (
  spec: ContentFormSpec,
  overrides?: ContentFormSkeletonOverrides,
): ContentFormSkeletonShape => ({
  fields: spec.fields.map(field => ({
    control: overrides?.[field.name] ?? contentSkeletonControlOf(field),
    name: field.name,
  })),
  sections: spec.sections.map(({ fields, name }) => ({ fields, name })),
});

const ContentFormSkeletonSections = ({
  fields,
  publication,
  sections,
}: {
  fields: Record<string, React.ReactNode>;
  publication: boolean;
  sections: readonly ContentFormSkeletonSection[];
}) => {
  const placed = new Set(sections.flatMap(section => section.fields));
  const remaining = Object.keys(fields).filter(name => !placed.has(name));

  return (
    <div className="flex flex-col gap-4">
      {publication ? <ContentFormStatusSkeleton /> : null}

      {sections.map(section => (
        <ContentFormSection
          key={section.name}
          title={<Skeleton className="h-4 w-40" />}
        >
          {section.fields.map(name => (
            <React.Fragment key={name}>{fields[name]}</React.Fragment>
          ))}
        </ContentFormSection>
      ))}

      {remaining.length > 0 ? (
        <div className="flex flex-col gap-6">
          {remaining.map(name => (
            <React.Fragment key={name}>{fields[name]}</React.Fragment>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ContentFormButtonSkeleton />
      </div>
    </div>
  );
};

interface ContentFormSkeletonProps {
  contentTypeId: string;
  header?: ContentFormHeaderValue;
  layout?: ContentFormLayout;
  mode: "create" | "edit";
  pluginId: string;
  publication?: boolean;
  shape: ContentFormSkeletonShape;
  singular: string;
  title?: string;
}

export const ContentFormSkeleton = ({
  contentTypeId,
  header,
  layout: Layout,
  mode,
  pluginId,
  publication = false,
  shape,
  singular,
  title,
}: ContentFormSkeletonProps) => {
  const { LinkComponent } = useContentFormNavigation();

  const fields = Object.fromEntries(
    shape.fields.map(field => [
      field.name,
      <ContentFormFieldSkeleton control={field.control} key={field.name} />,
    ]),
  );

  return (
    <ContentFormProvider
      value={{
        fieldNames: shape.fields.map(field => field.name),
        fields,
        header,
        LinkComponent,
        localizedFieldNames: [],
        mode,
        publication: { canPublish: false, enabled: publication },
        singular,
        skeleton: true,
        title,
      }}
    >
      {Layout ? (
        <Layout
          contentTypeId={contentTypeId}
          mode={mode}
          pluginId={pluginId}
          publication={publication}
          singular={singular}
          title={title}
        />
      ) : (
        <>
          <ContentFormHeader />
          <ContentFormSkeletonSections
            fields={fields}
            publication={publication && mode === "edit"}
            sections={shape.sections}
          />
        </>
      )}
    </ContentFormProvider>
  );
};
