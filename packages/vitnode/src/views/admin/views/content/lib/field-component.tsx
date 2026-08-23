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
  /** `user` fields only - a `relation` target has no avatar. */
  avatarColor?: string;
  /** A swatch, when the target content type declares `admin.colorField`. */
  color?: string;
  label: string;
  /** `user` fields only. */
  nameCode?: string;
  value: string;
}

export type ContentOptionsLoader = (args: {
  field: string;
  /**
   * Label exactly these identifiers instead of searching.
   *
   * What a to-many picker opens with. Its value is a list of ids and there is no
   * label on the row to have joined a name from, so the names are asked for
   * directly.
   */
  ids?: number[];
  search: string;
}) => Promise<ContentOption[]>;

export interface ContentFieldProps extends ItemAutoFormComponentProps {
  /**
   * The resolved descriptors of the record's file fields, keyed by field name.
   *
   * Read off the row's `files` sibling, which is what lets an edit form open
   * showing the cover image it already has rather than an empty drop zone - and,
   * for a `multiple: true` field, the gallery in its stored order. Absent while
   * creating, and absent for a content type with no file fields.
   */
  files?: Record<string, ContentFileFieldValue>;
  loadOptions: ContentOptionsLoader;
  spec: ContentFormFieldSpec;
  /**
   * Sends one file to the content type's generated multipart route.
   *
   * Supplied by the form rather than built here, so this component stays a
   * renderer: the upload is a `POST` of `multipart/form-data` driven by TanStack
   * Query, and never a Server Action.
   */
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
  // A collection cannot be `required` - the empty set is always storable - so a
  // minimum of one is the *other* way a field says "you have to choose
  // something", and a field that says it is not optional. Covers a to-many
  // reference with `min: 1` and a repeatable with `min: 1` alike.
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

    // The uploader. `maxBytes` is not optional on a `file` descriptor, so the
    // fallback is unreachable - it exists because the *spec* type is shared by
    // every kind and cannot say that.
    //
    // One component per arity rather than one with a branch: a gallery appends,
    // reorders and reports one failure per file, and a cover image replaces. The
    // per-file rules are the same object either way, which is what keeps the two
    // controls honest about the same field.
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

    // Split from `relation`, which it used to share a combobox with: an author
    // is a person, and a list of names in a dropdown is a worse way to find one
    // than a list of faces and handles.
    case "user":
      return spec.multiple ? (
        <ContentUserSetField loadOptions={loadOptions} spec={spec} {...props} />
      ) : (
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
