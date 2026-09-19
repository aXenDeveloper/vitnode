import { useTranslations } from "use-intl";

import type { ItemAutoFormComponentProps } from "../../components/form/auto-form";
import type { AnyFormFieldApi } from "../../components/ui/form";
import type { ContentFormFieldSpec } from "../../content/admin/spec";

import { AutoFormDateTime } from "../../components/form/fields/date-time";
import { AutoFormInput } from "../../components/form/fields/input";
import { AutoFormNullableNumber } from "../../components/form/fields/nullable-number";
import { AutoFormRadioGroup } from "../../components/form/fields/radio-group";
import { AutoFormSelect } from "../../components/form/fields/select";
import { AutoFormSwitch } from "../../components/form/fields/switch";
import { AutoFormTextarea } from "../../components/form/fields/textarea";
import { Switch } from "../../components/ui/switch";

export interface BlockPropertyFieldProps extends ItemAutoFormComponentProps {
  nested?: boolean;
  spec: ContentFormFieldSpec;
}

const otherPropsFor = (
  spec: ContentFormFieldSpec,
  { nested = false }: { nested?: boolean } = {},
): ItemAutoFormComponentProps["otherProps"] => ({
  clearsToEmpty: !nested && !spec.required && !spec.nullable,
  enum: spec.options?.map(option => option.value),
  isOptional: !spec.required,
  maxLength: spec.maxLength,
  minLength: spec.minLength,
});

const unwrapChange = (change: unknown): unknown =>
  change !== null && typeof change === "object" && "target" in change
    ? (change as { target: { checked?: boolean; value?: unknown } }).target
        .value
    : change;

const leafField = (
  name: string,
  value: unknown,
  onChange: (value: unknown) => void,
): AnyFormFieldApi => ({
  name,
  onBlur: () => undefined,
  onChange: (change: unknown) => {
    onChange(unwrapChange(change));
  },
  value,
});

const BlockPropertyGroup = ({ field, spec }: BlockPropertyFieldProps) => {
  const t = useTranslations("core.editor");
  const leaves = spec.fields ?? [];
  const value = field.value as null | Record<string, unknown> | undefined;
  const disabled = spec.nullable && value === null;

  return (
    <fieldset className="border-border rounded-lg border p-4">
      <legend className="px-1 text-sm font-medium">{spec.label}</legend>

      <div className="flex flex-col gap-4">
        {spec.nullable ? (
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm leading-relaxed">
              {t("group_enabled")}
            </span>
            <Switch
              aria-label={t("group_enabled")}
              checked={!disabled}
              onCheckedChange={checked => {
                field.onChange(
                  checked
                    ? Object.fromEntries(leaves.map(leaf => [leaf.name, null]))
                    : null,
                );
              }}
            />
          </div>
        ) : null}

        {disabled
          ? null
          : leaves.map(leaf => (
              <BlockPropertyField
                field={leafField(
                  `${field.name}.${leaf.name}`,
                  value?.[leaf.name],
                  next => {
                    field.onChange({ ...(value ?? {}), [leaf.name]: next });
                  },
                )}
                key={leaf.name}
                nested
                otherProps={otherPropsFor(leaf, { nested: true })}
                spec={leaf}
              />
            ))}
      </div>
    </fieldset>
  );
};

export const BlockPropertyField = ({
  nested = false,
  spec,
  ...props
}: BlockPropertyFieldProps) => {
  const t = useTranslations("core.editor");

  switch (spec.kind) {
    case "boolean":
      return <AutoFormSwitch label={spec.label} {...props} />;

    case "dateTime":
      return (
        <AutoFormDateTime
          label={spec.label}
          {...props}
          otherProps={otherPropsFor(spec, { nested })}
        />
      );

    case "enum":
      return spec.display === "radio" ? (
        <AutoFormRadioGroup
          label={spec.label}
          labels={spec.options ?? []}
          {...props}
        />
      ) : (
        <AutoFormSelect
          label={spec.label}
          labels={spec.options ?? []}
          {...props}
        />
      );

    case "group":
      return <BlockPropertyGroup spec={spec} {...props} />;

    case "number":
      return spec.nullable ? (
        <AutoFormNullableNumber
          label={spec.label}
          max={spec.max}
          min={spec.min}
          toggleLabel={t("no_value")}
          {...props}
        />
      ) : (
        <AutoFormInput
          label={spec.label}
          max={spec.max}
          min={spec.min}
          step={spec.integer ? 1 : "any"}
          type="number"
          {...props}
        />
      );

    case "textarea":
      return <AutoFormTextarea label={spec.label} rows={4} {...props} />;

    default:
      return <AutoFormInput label={spec.label} {...props} />;
  }
};
