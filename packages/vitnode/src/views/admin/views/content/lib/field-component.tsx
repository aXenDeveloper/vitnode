import { useTranslations } from "next-intl";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormFieldSpec } from "@/content/admin/spec";

import { AutoFormCombobox } from "@/components/form/fields/combobox";
import { AutoFormDateTime } from "@/components/form/fields/date-time";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormRadioGroup } from "@/components/form/fields/radio-group";
import { AutoFormSelect } from "@/components/form/fields/select";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { AutoFormTextarea } from "@/components/form/fields/textarea";

import { ContentGroupField } from "./group-field";
import { ContentRelationSetField } from "./relation-set-field";
import { ContentRepeatableField } from "./repeatable-field";
import { ContentUserField } from "./user-field";

/**
 * One option a picker can offer.
 *
 * Declared here rather than beside the server action that produces it: this is
 * the *client* contract, and a component reaching into a `"use server"` module
 * for a type drags `server-only` into the browser graph.
 */
export interface ContentOption {
  /** `user` fields only - a `relation` target has no avatar. */
  avatarColor?: string;
  label: string;
  /** `user` fields only. */
  nameCode?: string;
  value: string;
}

export type ContentOptionsLoader = (args: {
  field: string;
  search: string;
}) => Promise<ContentOption[]>;

export interface ContentFieldProps extends ItemAutoFormComponentProps {
  loadOptions: ContentOptionsLoader;
  spec: ContentFormFieldSpec;
}

/**
 * Maps a field descriptor onto the AdminCP input that already exists for it.
 *
 * Nothing new is invented here - a `relation` reuses the async combobox, a
 * `user` the people picker - and the loader behind both is a server action, so
 * the picker never needs the API origin or a second permission.
 *
 * `localized: true` becomes `multiLang` on the input, which is the AdminCP's
 * existing language-aware behaviour and not a Content Engine invention: the
 * field grows its own small language switcher and holds one value per language.
 * A plugin never writes a field override just because a field is translated.
 */
export const ContentField = ({
  loadOptions,
  spec,
  ...props
}: ContentFieldProps) => {
  const t = useTranslations("core.content.form");
  const multiLang = spec.localized === true;

  switch (spec.kind) {
    case "boolean":
      return <AutoFormSwitch label={spec.label} {...props} />;

    case "dateTime":
      return <AutoFormDateTime label={spec.label} {...props} />;

    case "enum": {
      const labels = spec.options ?? [];

      return spec.display === "radio" ? (
        <AutoFormRadioGroup label={spec.label} labels={labels} {...props} />
      ) : (
        <AutoFormSelect
          label={spec.label}
          labels={labels}
          placeholder={t("relation.placeholder")}
          {...props}
        />
      );
    }

    // The three Stage 6 editors. Each one controls the nested value the API
    // takes, so nothing is flattened on submit and nothing re-nested on load.
    case "group":
      return (
        <ContentGroupField loadOptions={loadOptions} spec={spec} {...props} />
      );

    case "number":
      // A nullable number needs the "no value" toggle; a plain one does not.
      return spec.nullable ? (
        <AutoFormNullableNumber
          label={spec.label}
          max={spec.max}
          min={spec.min}
          toggleLabel={t("boolean.off")}
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

    case "relation":
      if (spec.multiple) {
        return (
          <ContentRelationSetField
            loadOptions={loadOptions}
            spec={spec}
            {...props}
          />
        );
      }

      return (
        <AutoFormCombobox
          fetchData={async ({ search }) =>
            await loadOptions({ field: spec.name, search })
          }
          id={`content-${spec.name}`}
          label={spec.label}
          placeholder={t("relation.placeholder")}
          searchPlaceholder={t("relation.search_placeholder")}
          showClear={spec.nullable}
          {...props}
        />
      );

    case "repeatable":
      return (
        <ContentRepeatableField
          loadOptions={loadOptions}
          spec={spec}
          {...props}
        />
      );

    case "textarea":
      return (
        <AutoFormTextarea
          label={spec.label}
          multiLang={multiLang}
          rows={5}
          {...props}
        />
      );

    // Split from `relation`, which it used to share a combobox with: an author
    // is a person, and a list of names in a dropdown is a worse way to find one
    // than a list of faces and handles.
    case "user":
      return (
        <ContentUserField loadOptions={loadOptions} spec={spec} {...props} />
      );

    // `text` and `slug`. A localized slug switches language with the rest, and
    // the server still derives an empty one from *that* language's source field.
    default:
      return (
        <AutoFormInput label={spec.label} multiLang={multiLang} {...props} />
      );
  }
};
