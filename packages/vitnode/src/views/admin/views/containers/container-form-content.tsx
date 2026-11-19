import type { ContentContainerLabels } from "@vitnode/api/content/admin/containers";
import type { ContentContainerTreeRules } from "@vitnode/api/content/containers/tree";
import type {
  AnyContentContainerDefinition,
  ContentContainerIconField,
} from "@vitnode/api/content/containers/types";
import type { ContentFieldDescriptor } from "@vitnode/api/content/types";
import type { MultiLangValue } from "@vitnode/api/lib/helpers/multi-lang";

import {
  CONTENT_CONTAINER_NAME_MAX_LENGTH,
  CONTENT_CONTAINER_SLUG_MAX_LENGTH,
} from "@vitnode/api/content/containers/const";
import {
  CONTENT_CONTAINER_ICON_MAX_LENGTH,
  contentContainerIconFields,
} from "@vitnode/api/content/containers/icon";
import { planContentContainerCreate } from "@vitnode/api/content/containers/tree";
import { slugify } from "@vitnode/api/content/slug";
import {
  getLangValue,
  multiLangValueSchema,
  upsertLangValue,
} from "@vitnode/api/lib/helpers/multi-lang";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type {
  AutoFormOnSubmit,
  ItemAutoFormComponentProps,
} from "@/components/form/auto-form";
import type {
  ContentFormFieldSpec,
  ContentFormSpec,
} from "@/content/admin/spec";

import { AutoForm, setFormFieldError } from "@/components/form/auto-form";
import { AutoFormSheetFooter } from "@/components/form/auto-form-sheet-footer";
import { AutoFormInput } from "@/components/form/fields/input";
import { MultiLangDefaultLanguageContext } from "@/components/form/fields/multi-lang-default-language";
import { useLanguages } from "@/components/languages-provider";
import { useDialog } from "@/components/ui/dialog";
import { useFormApi } from "@/components/ui/form";
import {
  buildFormSchemaFromSpec,
  projectFormField,
} from "@/content/admin/spec";
import { ContentField } from "@/views/admin/views/content/lib/field-component";

import type {
  AdminContentContainer,
  AdminContentContainerTranslation,
  ContentContainerIconUploadResult,
  ContentContainerMutationResult,
  ContentContainerWriteBody,
} from "./container-request";

import { AutoFormContainerIcon } from "./container-icon-field";
import { contentContainerErrorKey } from "./container-query";
import {
  AutoFormContainerSelect,
  containerSelectOptions,
} from "./container-select";

export interface ContentContainerSaveArgs {
  body: ContentContainerWriteBody;
  id?: number;
  parentId?: null | number;
}

export type ContentContainerSave = (
  args: ContentContainerSaveArgs,
) => Promise<ContentContainerMutationResult<null>>;

export type ContentContainerIconUpload = (args: {
  field: string;
  file: File;
}) => Promise<ContentContainerIconUploadResult>;

export interface ContentContainerFormProps {
  container?: AdminContentContainer;
  definition: AnyContentContainerDefinition;
  labels: Pick<ContentContainerLabels, "labelEnum" | "labelField" | "singular">;
  onSave: ContentContainerSave;
  onSaved?: () => void;
  onUploadIcon: ContentContainerIconUpload;
  parentId?: null | number;
  pluginId: string;
  records: readonly AdminContentContainer[];
  rules: ContentContainerTreeRules;
}

const SLUG_ERRORS: ReadonlySet<string> = new Set(["slugEmpty", "slugTaken"]);

const SINGLE_LANGUAGE = "";

const noOptions = async () => await Promise.resolve([]);

const metadataSpec = (
  definition: AnyContentContainerDefinition,
  labels: ContentContainerFormProps["labels"],
  pluginId: string,
): ContentFormSpec => ({
  contentTypeId: definition.id,
  defaultLocale: definition.localization.defaultLocale,
  fields: Object.entries(definition.fields)
    .filter(([, descriptor]) => descriptor.kind !== "icon")
    .map(([name, descriptor]) =>
      projectFormField(
        name,
        descriptor as ContentFieldDescriptor,
        labels.labelEnum,
        fieldName => labels.labelField(fieldName),
      ),
    ),
  permissionModule: definition.admin.permissionModule,
  pluginId,
  sections: [],
  titleField: null,
});

const emptyToNull = (
  fieldSpec: ContentFormFieldSpec,
  value: unknown,
): unknown =>
  value === "" &&
  fieldSpec.nullable &&
  (fieldSpec.kind === "text" || fieldSpec.kind === "textarea")
    ? null
    : value;

const multiLangOf = (
  defaultLocale: string,
  base: unknown,
  translations: Record<string, AdminContentContainerTranslation>,
  pick: (translation: AdminContentContainerTranslation) => unknown,
): MultiLangValue => [
  ...(typeof base === "string" && base !== ""
    ? [{ languageCode: defaultLocale, value: base }]
    : []),
  ...Object.entries(translations).flatMap(([languageCode, translation]) => {
    const value = pick(translation);

    return typeof value === "string" && value !== ""
      ? [{ languageCode, value }]
      : [];
  }),
];

const changedLanguages = (
  before: unknown,
  after: unknown,
  isLocalized: boolean,
): { language: string; next: string; previous: string }[] => {
  if (!isLocalized) {
    return [
      {
        language: SINGLE_LANGUAGE,
        next: typeof after === "string" ? after : "",
        previous: typeof before === "string" ? before : "",
      },
    ];
  }

  const previous = Array.isArray(before) ? (before as MultiLangValue) : [];
  const next = Array.isArray(after) ? (after as MultiLangValue) : [];
  const codes = new Set(
    [...previous, ...next].map(entry => entry.languageCode),
  );

  return [...codes].flatMap(language => {
    const was = getLangValue(previous, language);
    const now = getLangValue(next, language);

    return was === now ? [] : [{ language, next: now, previous: was }];
  });
};

const slugOf = (value: string): string =>
  slugify(value, CONTENT_CONTAINER_SLUG_MAX_LENGTH);

const ContainerNameField = ({
  isLocalized,
  lockedSlugs,
  ...props
}: ItemAutoFormComponentProps & {
  isLocalized: boolean;
  label: string;
  lockedSlugs: ReadonlySet<string>;
}) => {
  const { form } = useFormApi();
  const { field } = props;

  const syncSlug = (next: unknown) => {
    const value =
      next !== null && typeof next === "object" && "target" in next
        ? (next as { target: { value: string } }).target.value
        : next;
    let slugs: unknown = form.getFieldValue("slug");
    let synced = false;

    for (const change of changedLanguages(field.value, value, isLocalized)) {
      if (lockedSlugs.has(change.language)) continue;

      const current = isLocalized
        ? getLangValue(slugs as MultiLangValue, change.language)
        : typeof slugs === "string"
          ? slugs
          : "";
      if (current !== "" && current !== slugOf(change.previous)) continue;

      const slug = slugOf(change.next);
      slugs = isLocalized
        ? upsertLangValue(slugs as MultiLangValue, change.language, slug)
        : slug;
      synced = true;
    }

    if (synced) form.setFieldValue("slug", slugs);
    field.onChange(next);
  };

  return (
    <AutoFormInput
      {...props}
      autoComplete="off"
      field={{ ...field, onChange: syncSlug }}
      multiLang={isLocalized}
    />
  );
};

type ContainerTranslations = Record<string, AdminContentContainerTranslation>;

const initialMetadataOf = ({
  container,
  defaultLocale,
  localizedSpecs,
}: {
  container: AdminContentContainer | undefined;
  defaultLocale: null | string;
  localizedSpecs: readonly ContentFormFieldSpec[];
}): Record<string, unknown> => {
  if (defaultLocale === null) return { ...container?.metadata };

  return {
    ...container?.metadata,
    ...Object.fromEntries(
      localizedSpecs.map(fieldSpec => [
        fieldSpec.name,
        multiLangOf(
          defaultLocale,
          container?.metadata[fieldSpec.name],
          container?.translations ?? {},
          translation => translation.metadata?.[fieldSpec.name],
        ),
      ]),
    ),
  };
};

const lockedSlugsOf = (
  container: AdminContentContainer | undefined,
  defaultLocale: null | string,
): ReadonlySet<string> =>
  new Set(
    container
      ? [
          defaultLocale ?? SINGLE_LANGUAGE,
          ...Object.entries(container.translations).flatMap(
            ([code, translation]) => (translation.slug ? [code] : []),
          ),
        ]
      : [],
  );

const nameSchemaOf = ({
  container,
  defaultLocale,
  requiredMessage,
}: {
  container: AdminContentContainer | undefined;
  defaultLocale: null | string;
  requiredMessage: string;
}) =>
  defaultLocale === null
    ? z
        .string()
        .trim()
        .min(1)
        .max(CONTENT_CONTAINER_NAME_MAX_LENGTH)
        .default(container?.name ?? "")
    : multiLangValueSchema({ maxLength: CONTENT_CONTAINER_NAME_MAX_LENGTH })
        .superRefine((rows, ctx) => {
          if (getLangValue(rows, defaultLocale).trim() !== "") return;
          ctx.addIssue({ code: "custom", message: requiredMessage });
        })
        .default(
          multiLangOf(
            defaultLocale,
            container?.name,
            container?.translations ?? {},
            translation => translation.name,
          ),
        );

const slugSchemaOf = (
  container: AdminContentContainer | undefined,
  defaultLocale: null | string,
) =>
  defaultLocale === null
    ? z
        .string()
        .trim()
        .max(CONTENT_CONTAINER_SLUG_MAX_LENGTH)
        .default(container?.slug ?? "")
    : multiLangValueSchema({
        maxLength: CONTENT_CONTAINER_SLUG_MAX_LENGTH,
      }).default(
        multiLangOf(
          defaultLocale,
          container?.slug,
          container?.translations ?? {},
          translation => translation.slug,
        ),
      );

const iconSchemaShape = (
  iconFields: readonly [string, ContentContainerIconField][],
  container: AdminContentContainer | undefined,
) =>
  Object.fromEntries(
    iconFields.map(([name]) => {
      const current = container?.metadata[name];

      return [
        name,
        z
          .string()
          .max(CONTENT_CONTAINER_ICON_MAX_LENGTH)
          .default(typeof current === "string" ? current : ""),
      ];
    }),
  );

const metadataBodyOf = ({
  defaultLocale,
  iconFields,
  specFields,
  values,
}: {
  defaultLocale: null | string;
  iconFields: readonly [string, ContentContainerIconField][];
  specFields: readonly ContentFormFieldSpec[];
  values: Record<string, unknown>;
}): Record<string, unknown> => {
  const metadata: Record<string, unknown> = {};
  for (const fieldSpec of specFields) {
    const raw = values[fieldSpec.name];
    if (raw === undefined) continue;
    metadata[fieldSpec.name] = emptyToNull(
      fieldSpec,
      fieldSpec.localized === true && defaultLocale !== null
        ? getLangValue(raw as MultiLangValue, defaultLocale).trim()
        : raw,
    );
  }
  for (const [name] of iconFields) {
    const raw = values[name];
    metadata[name] = typeof raw === "string" && raw !== "" ? raw : null;
  }

  return metadata;
};

const translationsBodyOf = ({
  defaultLocale,
  localizedSpecs,
  values,
}: {
  defaultLocale: string;
  localizedSpecs: readonly ContentFormFieldSpec[];
  values: Record<string, unknown>;
}): ContainerTranslations => {
  const names = values.name as MultiLangValue;
  const slugs = values.slug as MultiLangValue;
  const localized = localizedSpecs.map(fieldSpec => ({
    name: fieldSpec.name,
    value: values[fieldSpec.name] as MultiLangValue,
  }));
  const codes = new Set(
    [names, slugs, ...localized.map(entry => entry.value)]
      .flat()
      .map(entry => entry.languageCode)
      .filter(code => code !== defaultLocale),
  );

  return Object.fromEntries(
    [...codes].map(code => [
      code,
      {
        metadata: Object.fromEntries(
          localized.map(entry => [
            entry.name,
            getLangValue(entry.value, code).trim(),
          ]),
        ),
        name: getLangValue(names, code).trim(),
        slug: getLangValue(slugs, code).trim(),
      },
    ]),
  );
};

const containerBodyOf = ({
  defaultLocale,
  iconFields,
  localizedSpecs,
  specFields,
  values,
}: {
  defaultLocale: null | string;
  iconFields: readonly [string, ContentContainerIconField][];
  localizedSpecs: readonly ContentFormFieldSpec[];
  specFields: readonly ContentFormFieldSpec[];
  values: Record<string, unknown>;
}): ContentContainerWriteBody => {
  const metadata = metadataBodyOf({
    defaultLocale,
    iconFields,
    specFields,
    values,
  });

  if (defaultLocale === null) {
    const slug = typeof values.slug === "string" ? values.slug : "";

    return {
      metadata,
      name: typeof values.name === "string" ? values.name : "",
      ...(slug === "" ? {} : { slug }),
    };
  }

  const slug = getLangValue(
    values.slug as MultiLangValue,
    defaultLocale,
  ).trim();

  return {
    metadata,
    name: getLangValue(values.name as MultiLangValue, defaultLocale).trim(),
    ...(slug === "" ? {} : { slug }),
    translations: translationsBodyOf({ defaultLocale, localizedSpecs, values }),
  };
};

export const ContentContainerFormContent = ({
  container,
  definition,
  labels,
  onSave,
  onSaved,
  onUploadIcon,
  parentId: initialParentId = null,
  pluginId,
  records,
  rules,
}: ContentContainerFormProps) => {
  const t = useTranslations("core.containers");
  const tError = useTranslations("core.global.errors");
  const { setIsDirty, setOpen } = useDialog();
  const languages = useLanguages();
  const isEdit = container !== undefined;
  const { defaultLocale } = definition.localization;
  const isLocalized = defaultLocale !== null;
  const iconFields = contentContainerIconFields(definition);
  const [pendingUploads, setPendingUploads] = React.useState(0);
  const isUploading = pendingUploads > 0;

  const uploadIcon: ContentContainerIconUpload = async args => {
    setPendingUploads(count => count + 1);
    try {
      return await onUploadIcon(args);
    } finally {
      setPendingUploads(count => count - 1);
    }
  };

  const spec = metadataSpec(definition, labels, pluginId);
  const localizedSpecs = spec.fields.filter(field => field.localized === true);
  const metadataShape = buildFormSchemaFromSpec(
    spec,
    initialMetadataOf({ container, defaultLocale, localizedSpecs }),
  ).shape;
  const lockedSlugs = lockedSlugsOf(container, defaultLocale);

  const parents = isEdit
    ? []
    : records.filter(
        record =>
          planContentContainerCreate(
            records,
            { parentId: record.id, position: undefined },
            rules,
          ).ok,
      );
  const showParent = !isEdit && rules.hierarchy;
  const parentIds = new Set(parents.map(record => record.id));
  const defaultLanguageName =
    languages.find(language => language.code === defaultLocale)?.name ??
    defaultLocale ??
    "";

  const formSchema = z.object({
    name: nameSchemaOf({
      container,
      defaultLocale,
      requiredMessage: t("form.nameRequired", {
        language: defaultLanguageName,
      }),
    }),
    slug: slugSchemaOf(container, defaultLocale),
    ...(showParent
      ? {
          parentId: z
            .number()
            .int()
            .positive()
            .nullable()
            .default(
              initialParentId !== null && parentIds.has(initialParentId)
                ? initialParentId
                : null,
            ),
        }
      : {}),
    ...metadataShape,
    ...iconSchemaShape(iconFields, container),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    form,
  ) => {
    if (isUploading) return;

    const record = values as Record<string, unknown>;
    const body = containerBodyOf({
      defaultLocale,
      iconFields,
      localizedSpecs,
      specFields: spec.fields,
      values: record,
    });
    const parentId = showParent
      ? ((record.parentId as null | number | undefined) ?? null)
      : null;

    const result = await onSave(
      isEdit ? { body, id: container.id } : { body, parentId },
    );

    if ("error" in result) {
      const message = t(contentContainerErrorKey(result.error));
      if (result.error.code && SLUG_ERRORS.has(result.error.code)) {
        setFormFieldError(form, "slug", message);

        return;
      }

      toast.error(tError("title"), { description: message });

      return;
    }

    toast.success(t(isEdit ? "edit.success" : "create.success"), {
      description: t(isEdit ? "edit.successDesc" : "create.successDesc", {
        name: body.name ?? "",
      }),
    });
    setIsDirty?.(false);
    setOpen?.(false);
    onSaved?.();
  };

  const metadataFields = spec.fields.map(fieldSpec => ({
    component: (props: ItemAutoFormComponentProps) => (
      <ContentField loadOptions={noOptions} spec={fieldSpec} {...props} />
    ),
    id: fieldSpec.name,
  }));

  const iconFormFields = iconFields.map(([name, descriptor]) => ({
    component: (props: ItemAutoFormComponentProps) => (
      <AutoFormContainerIcon
        field={props.field}
        isOptional={!descriptor.required}
        label={labels.labelField(name)}
        maxBytes={descriptor.maxBytes}
        onUpload={async file => await uploadIcon({ field: name, file })}
      />
    ),
    id: name,
  }));

  const detailNames = [
    ...iconFields.map(([name]) => name),
    ...spec.fields.map(fieldSpec => fieldSpec.name),
  ];

  return (
    <MultiLangDefaultLanguageContext value={defaultLocale}>
      <AutoForm
        className="flex min-h-0 flex-1 flex-col gap-0"
        fields={[
          {
            component: props => (
              <ContainerNameField
                {...props}
                isLocalized={isLocalized}
                label={t("form.name")}
                lockedSlugs={lockedSlugs}
              />
            ),
            id: "name",
          },
          {
            component: props => (
              <AutoFormInput
                {...props}
                autoComplete="off"
                description={t("form.slugDesc")}
                label={t("form.slug")}
                multiLang={isLocalized}
                spellCheck={false}
              />
            ),
            id: "slug",
          },
          ...(showParent
            ? [
                {
                  component: (props: ItemAutoFormComponentProps) => (
                    <AutoFormContainerSelect
                      {...props}
                      label={t("form.parent")}
                      options={[
                        { depth: 1, id: null, label: t("form.parentRoot") },
                        ...containerSelectOptions(parents).map(option => ({
                          ...option,
                          depth: option.depth + 1,
                        })),
                      ]}
                    />
                  ),
                  id: "parentId",
                },
              ]
            : []),
          ...iconFormFields,
          ...metadataFields,
        ]}
        formSchema={formSchema}
        layout={rendered => (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-5">
              {rendered.name}
              {rendered.slug}
              {showParent ? rendered.parentId : null}
              {detailNames.length > 0 ? (
                <section
                  aria-label={t("form.fields")}
                  className="flex flex-col gap-5 border-t pt-5"
                >
                  {detailNames.map(name => (
                    <div className="flex flex-col gap-2" key={name}>
                      {rendered[name]}
                    </div>
                  ))}
                </section>
              ) : null}
            </div>
            <AutoFormSheetFooter
              disabled={isUploading}
              submitLabel={t(isEdit ? "edit.submit" : "create.submit")}
            />
          </>
        )}
        onSubmit={onSubmit}
      />
    </MultiLangDefaultLanguageContext>
  );
};
