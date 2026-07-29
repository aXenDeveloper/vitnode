"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { cn } from "@/lib/utils";

import type { InputParams } from "../../../lib/helpers/auto-form";
import type { ItemAutoFormComponentProps } from "../auto-form";

import { getNestedParam } from "../../../lib/helpers/auto-form";
import { Button } from "../../ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "../../ui/field";
import { FormField } from "../../ui/form";

export interface AutoFormArrayField {
  className?: string;
  component: (props: ItemAutoFormComponentProps) => React.ReactNode;
  id: string;
}

export interface AutoFormArrayProps extends ItemAutoFormComponentProps {
  addButtonLabel?: string;
  className?: string;
  fields: AutoFormArrayField[];
  itemParams?: InputParams;
  maxItems?: number;
  minItems?: number;
  showRemoveButton?: boolean;
}

export const AutoFormArray = ({
  label,
  field: parentField,
  description,
  fields: fieldDefinitions,
  addButtonLabel = "Add Item",
  maxItems: maxItemsProp,
  minItems: minItemsProp,
  showRemoveButton = true,
  className,
  itemParams,
  otherProps,
}: AutoFormArrayProps) => {
  const { control, formState } = useFormContext();
  const t = useTranslations("core.global");
  const id = parentField.name;

  const { fields, append, remove } = useFieldArray({
    control,
    name: id,
  });

  const maxItems = maxItemsProp ?? otherProps.maxItems;
  const minItems = minItemsProp ?? otherProps.minItems ?? 0;

  const canRemove = fields.length > minItems;
  const canAdd = !maxItems || fields.length < maxItems;

  const arrayError = formState.errors[id] as
    undefined | { message?: string; root?: { message?: string } };

  return (
    <FieldSet className={cn("gap-4", className)}>
      {!!label && <FieldLegend variant="label">{label}</FieldLegend>}
      {!!description && <FieldDescription>{description}</FieldDescription>}

      <FieldGroup className="gap-4">
        {fields.map((field, index) => (
          <Field
            className="@md/field-group:items-end"
            key={field.id}
            orientation="responsive"
          >
            {fieldDefinitions.map(fieldDef => {
              const fullFieldName = `${id}.${index}.${fieldDef.id}`;
              const fieldParams = itemParams
                ? getNestedParam(itemParams, fieldDef.id)
                : undefined;

              return (
                <FormField
                  key={fullFieldName}
                  name={fullFieldName}
                  render={({ field, fieldState }) => (
                    <Field
                      className={fieldDef.className}
                      data-invalid={fieldState.invalid}
                    >
                      {fieldDef.component({
                        field,
                        itemParams:
                          fieldParams &&
                          typeof fieldParams === "object" &&
                          "itemParams" in fieldParams
                            ? (fieldParams.itemParams as InputParams)
                            : undefined,
                        description:
                          typeof fieldParams === "object" &&
                          fieldParams &&
                          "description" in fieldParams &&
                          typeof fieldParams.description === "string"
                            ? fieldParams.description
                            : undefined,
                        otherProps: {
                          isOptional: false,
                          ["aria-invalid"]: fieldState.invalid,
                          enum:
                            fieldParams &&
                            typeof fieldParams === "object" &&
                            "enum" in fieldParams &&
                            Array.isArray(fieldParams.enum)
                              ? fieldParams.enum
                              : undefined,
                          maxLength:
                            typeof fieldParams === "object" &&
                            fieldParams &&
                            "maxLength" in fieldParams &&
                            typeof fieldParams.maxLength === "number"
                              ? fieldParams.maxLength
                              : undefined,
                          minLength:
                            typeof fieldParams === "object" &&
                            fieldParams &&
                            "minLength" in fieldParams &&
                            typeof fieldParams.minLength === "number"
                              ? fieldParams.minLength
                              : undefined,
                          pattern:
                            typeof fieldParams === "object" &&
                            fieldParams &&
                            "pattern" in fieldParams &&
                            typeof fieldParams.pattern === "string"
                              ? fieldParams.pattern
                              : undefined,
                          type:
                            typeof fieldParams === "object" &&
                            fieldParams &&
                            "type" in fieldParams &&
                            typeof fieldParams.type === "string"
                              ? fieldParams.type
                              : undefined,
                        },
                      })}
                    </Field>
                  )}
                />
              );
            })}

            {canRemove && showRemoveButton && fields.length > 0 && (
              <FieldLegend className="mb-2 flex justify-end">
                <Button
                  aria-label={t("remove")}
                  onClick={() => remove(index)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2Icon />
                </Button>
              </FieldLegend>
            )}
          </Field>
        ))}

        <Button
          className="w-fit"
          disabled={!canAdd}
          onClick={() => {
            const newItem = fieldDefinitions.reduce<Record<string, unknown>>(
              (acc, fieldDef) => {
                acc[fieldDef.id] = undefined;

                return acc;
              },
              {},
            );
            append(newItem);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <PlusIcon />
          {addButtonLabel}
        </Button>
      </FieldGroup>

      {(arrayError?.root?.message ?? arrayError?.message) && (
        <FieldError
          errors={[{ message: arrayError.root?.message ?? arrayError.message }]}
        />
      )}
    </FieldSet>
  );
};
