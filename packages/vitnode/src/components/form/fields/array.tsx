import { getBy, useSelector } from "@tanstack/react-form";
import { cn } from "cn";
import { PlusIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

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
import {
  FormField,
  pushFormFieldValue,
  removeFormFieldValue,
  useFormApi,
  useFormField,
} from "../../ui/form";
import { AutoFormFieldSlot } from "../auto-form";

const reconcileRowKeys = (previous: number[], length: number): number[] => {
  if (previous.length >= length) {
    return previous.slice(0, length);
  }

  const nextKey = previous.length > 0 ? Math.max(...previous) + 1 : 0;

  return [
    ...previous,
    ...Array.from(
      { length: length - previous.length },
      (_, at) => nextKey + at,
    ),
  ];
};

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
  const { form } = useFormApi();
  const { errors } = useFormField();
  const t = useTranslations("core.global");
  const id = parentField.name;

  const length = useSelector(form.store, state => {
    const rows: unknown = getBy(state.values, id);

    return Array.isArray(rows) ? rows.length : 0;
  });

  const [storedRowKeys, setStoredRowKeys] = React.useState<number[]>(() =>
    reconcileRowKeys([], length),
  );
  const rowKeys =
    storedRowKeys.length === length
      ? storedRowKeys
      : reconcileRowKeys(storedRowKeys, length);

  if (rowKeys !== storedRowKeys) {
    setStoredRowKeys(rowKeys);
  }

  const maxItems = maxItemsProp ?? otherProps.maxItems;
  const minItems = minItemsProp ?? otherProps.minItems ?? 0;

  const canRemove = length > minItems;
  const canAdd = !maxItems || length < maxItems;

  return (
    <FieldSet className={cn("gap-4", className)}>
      {!!label && <FieldLegend variant="label">{label}</FieldLegend>}
      {!!description && <FieldDescription>{description}</FieldDescription>}

      <FieldGroup className="gap-4">
        {rowKeys.map((rowKey, index) => (
          <Field
            className="@md/field-group:items-end"
            key={rowKey}
            orientation="responsive"
          >
            {fieldDefinitions.map(fieldDef => {
              const fullFieldName = `${id}[${index}].${fieldDef.id}`;
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
                      <AutoFormFieldSlot
                        component={fieldDef.component}
                        description={
                          typeof fieldParams === "object" &&
                          fieldParams &&
                          "description" in fieldParams &&
                          typeof fieldParams.description === "string"
                            ? fieldParams.description
                            : undefined
                        }
                        field={field}
                        itemParams={
                          fieldParams &&
                          typeof fieldParams === "object" &&
                          "itemParams" in fieldParams
                            ? (fieldParams.itemParams as InputParams)
                            : undefined
                        }
                        otherProps={{
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
                        }}
                      />
                    </Field>
                  )}
                />
              );
            })}

            {canRemove && showRemoveButton && length > 0 && (
              <FieldLegend className="mb-2 flex justify-end">
                <Button
                  aria-label={t("remove")}
                  onClick={() => {
                    setStoredRowKeys(previous =>
                      previous.filter((_, at) => at !== index),
                    );
                    removeFormFieldValue(form, id, index);
                  }}
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
            pushFormFieldValue(form, id, newItem);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <PlusIcon />
          {addButtonLabel}
        </Button>
      </FieldGroup>

      {errors.length > 0 && <FieldError errors={errors} />}
    </FieldSet>
  );
};
