import { useTranslations } from "next-intl";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormFieldSpec } from "@/content/admin/spec";
import type {
  ContentFileDescriptor,
  ContentFileFieldValue,
} from "@/content/files";

import { AutoFormCombobox } from "@/components/form/fields/combobox";
import { AutoFormDateTime } from "@/components/form/fields/date-time";
import { AutoFormFile } from "@/components/form/fields/file";
import { AutoFormFiles } from "@/components/form/fields/files";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormRadioGroup } from "@/components/form/fields/radio-group";
import { AutoFormSelect } from "@/components/form/fields/select";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { AutoFormTextarea } from "@/components/form/fields/textarea";

import { ContentGroupField } from "./group-field";
import { ContentOptionSwatch } from "./option-swatch";
import { contentOptionsQueryKey } from "./options-query";
import { ContentRelationSetField } from "./relation-set-field";
import { ContentRepeatableField } from "./repeatable-field";
import { ContentUserField } from "./user-field";
import { ContentUserSetField } from "./user-set-field";

/**
 * One option a picker can offer.
 *
 * Declared here rather than beside the server action that produces it: this is
 * the *client* contract, and a component reaching into a `"use server"` module
 * for a type drags `server-only` into the browser graph.
 */
export interface ContentOption {
  avatarColor?: string;
  color?: string;
  label: string;
  nameCode?: string;
  value: string;
}

export type ContentOptionsLoader = (args: {
  field: string;
  ids?: number[];
  search: string;
}) => Promise<ContentOption[]>;

export interface ContentFieldProps extends ItemAutoFormComponentProps {
  files?: Record<string, ContentFileFieldValue>;
  loadOptions: ContentOptionsLoader;
  spec: ContentFormFieldSpec;
  uploadFile?: (args: {
    field: string;
    file: File;
  }) => Promise<ContentFileDescriptor>;
}

/** The `files` entry of one field, narrowed to the arity that field has. */
const fileValue = (
  files: Record<string, ContentFileFieldValue> | undefined,
  name: string,
): ContentFileDescriptor | null => {
  const value = files?.[name];

  return value === undefined || Array.isArray(value) ? null : value;
};

const fileList = (
  files: Record<string, ContentFileFieldValue> | undefined,
  name: string,
): ContentFileDescriptor[] => {
  const value = files?.[name];

  return Array.isArray(value) ? value : [];
};

export const ContentField = ({
  files,
  loadOptions,
  spec,
  uploadFile,
  ...rest
}: ContentFieldProps) => {
  const t = useTranslations("core.content.form");
  const multiLang = spec.localized === true;
  const isOptional = !spec.required && (spec.minItems ?? 0) === 0;
  const props = {
    ...rest,
    otherProps: { ...rest.otherProps, isOptional },
  };

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

    case "file": {
      const upload = async (file: File) =>
        uploadFile
          ? await uploadFile({ field: spec.name, file })
          : Promise.reject(new Error(t("file.unavailable")));

      if (spec.multiple) {
        return (
          <AutoFormFiles
            allowedExtensions={spec.allowedExtensions}
            allowedMimeTypes={spec.allowedMimeTypes}
            files={fileList(files, spec.name)}
            label={spec.label}
            maxBytes={spec.maxBytes ?? 0}
            maxItems={spec.maxItems ?? 0}
            minItems={spec.minItems}
            onUpload={upload}
            ordered={spec.ordered !== false}
            {...props}
          />
        );
      }

      return (
        <AutoFormFile
          allowedExtensions={spec.allowedExtensions}
          allowedMimeTypes={spec.allowedMimeTypes}
          file={fileValue(files, spec.name)}
          label={spec.label}
          maxBytes={spec.maxBytes ?? 0}
          onUpload={upload}
          {...props}
        />
      );
    }

    case "group":
      return (
        <ContentGroupField loadOptions={loadOptions} spec={spec} {...props} />
      );

    case "number":
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
          queryKey={contentOptionsQueryKey(spec)}
          renderItem={item => <ContentOptionSwatch option={item} />}
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

    case "user":
      return spec.multiple ? (
        <ContentUserSetField loadOptions={loadOptions} spec={spec} {...props} />
      ) : (
        <ContentUserField loadOptions={loadOptions} spec={spec} {...props} />
      );

    default:
      return (
        <AutoFormInput label={spec.label} multiLang={multiLang} {...props} />
      );
  }
};
