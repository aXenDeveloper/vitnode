import React from "react";
import { useTranslations } from "use-intl";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormFieldSpec } from "@/content/admin/spec";

import { Switch } from "@/components/ui/switch";

import type { ContentOptionsLoader } from "./field-component";

import { ContentLeafField } from "./leaf-field";

export interface ContentGroupFieldProps extends ItemAutoFormComponentProps {
  loadOptions: ContentOptionsLoader;
  spec: ContentFormFieldSpec;
}

export const ContentGroupField = ({
  field,
  loadOptions,
  spec,
  ...props
}: ContentGroupFieldProps) => {
  const t = useTranslations("core.content.form");
  const leaves = spec.fields ?? [];
  const value = field.value as null | Record<string, unknown> | undefined;
  const isNull = spec.nullable && value === null;
  const legendId = `content-group-${spec.name}`;

  const setLeaf = (leaf: string, next: unknown) => {
    field.onChange({ ...(value ?? {}), [leaf]: next });
  };

  return (
    <fieldset
      aria-describedby={spec.description ? `${legendId}-desc` : undefined}
      className="rounded-lg border p-4"
    >
      <legend className="text-sm font-medium" id={legendId}>
        {spec.label}
      </legend>

      {!!spec.description && (
        <p className="text-muted-foreground text-sm" id={`${legendId}-desc`}>
          {spec.description}
        </p>
      )}

      {spec.nullable && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <span className="text-sm">{t("group.enabled")}</span>
          <Switch
            aria-label={t("group.enabled")}
            checked={!isNull}
            onCheckedChange={checked => {
              field.onChange(
                checked
                  ? Object.fromEntries(leaves.map(leaf => [leaf.name, null]))
                  : null,
              );
            }}
          />
        </div>
      )}

      {!isNull && (
        <div className="mt-4 flex flex-col gap-4">
          {leaves.map(leaf => (
            <ContentLeafField
              key={leaf.name}
              loadOptions={loadOptions}
              name={`${field.name}.${leaf.name}`}
              onChange={next => {
                setLeaf(leaf.name, next);
              }}
              otherProps={props.otherProps}
              spec={leaf}
              value={value?.[leaf.name]}
            />
          ))}
        </div>
      )}
    </fieldset>
  );
};
