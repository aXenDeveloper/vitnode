import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type {
  AutoFormOnSubmit,
  ItemAutoFormComponentProps,
} from "@/components/form/auto-form";
import type { ContentContainerLabels } from "@/content/admin/containers";
import type {
  ContentFormFieldSpec,
  ContentFormSpec,
} from "@/content/admin/spec";
import type { ContentContainerTreeRules } from "@/content/containers/tree";
import type { AnyContentContainerDefinition } from "@/content/containers/types";
import type { ContentFieldDescriptor } from "@/content/types";

import { AutoForm, setFormFieldError } from "@/components/form/auto-form";
import { AutoFormSheetFooter } from "@/components/form/auto-form-sheet-footer";
import { AutoFormInput } from "@/components/form/fields/input";
import { useDialog } from "@/components/ui/dialog";
import {
  buildFormSchemaFromSpec,
  projectFormField,
} from "@/content/admin/spec";
import {
  CONTENT_CONTAINER_NAME_MAX_LENGTH,
  CONTENT_CONTAINER_SLUG_MAX_LENGTH,
} from "@/content/containers/const";
import { planContentContainerCreate } from "@/content/containers/tree";
import { ContentField } from "@/views/admin/views/content/lib/field-component";

import type {
  AdminContentContainer,
  ContentContainerMutationResult,
  ContentContainerWriteBody,
} from "./container-request";

import { contentContainerErrorKey } from "./container-query";
import {
  AutoFormContainerSelect,
  containerSelectOptions,
} from "./container-select";

export interface ContentContainerSaveArgs {
  body: ContentContainerWriteBody;
  /** Set while editing. */
  id?: number;
  /** Create only: `null` for the top level. */
  parentId?: null | number;
}

export type ContentContainerSave = (
  args: ContentContainerSaveArgs,
) => Promise<ContentContainerMutationResult<AdminContentContainer | null>>;

export interface ContentContainerFormProps {
  /** The container being edited; absent when creating one. */
  container?: AdminContentContainer;
  definition: AnyContentContainerDefinition;
  labels: Pick<ContentContainerLabels, "labelEnum" | "labelField" | "singular">;
  onSave: ContentContainerSave;
  onSaved?: () => void;
  /** Create only: where the new container goes until the admin picks otherwise. */
  parentId?: null | number;
  pluginId: string;
  records: readonly AdminContentContainer[];
  rules: ContentContainerTreeRules;
}

const SLUG_ERRORS: ReadonlySet<string> = new Set(["slugEmpty", "slugTaken"]);

const noOptions = async () => await Promise.resolve([]);

/** A definition's own fields, as the Content Engine's form spec - so the inputs are the same ones a content form renders. */
const metadataSpec = (
  definition: AnyContentContainerDefinition,
  labels: ContentContainerFormProps["labels"],
  pluginId: string,
): ContentFormSpec => ({
  contentTypeId: definition.id,
  defaultLocale: null,
  fields: Object.entries(definition.fields).map(([name, descriptor]) =>
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

/** An empty text box on a nullable field means "no value", not "an empty string". */
const metadataForApi = (
  fields: readonly ContentFormFieldSpec[],
  values: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    fields.flatMap(field => {
      const value = values[field.name];
      if (value === undefined) return [];
      if (
        value === "" &&
        field.nullable &&
        (field.kind === "text" || field.kind === "textarea")
      ) {
        return [[field.name, null]];
      }

      return [[field.name, value]];
    }),
  );

export const ContentContainerFormContent = ({
  container,
  definition,
  labels,
  onSave,
  onSaved,
  parentId: initialParentId = null,
  pluginId,
  records,
  rules,
}: ContentContainerFormProps) => {
  const t = useTranslations("core.containers");
  const tError = useTranslations("core.global.errors");
  const { setIsDirty, setOpen } = useDialog();
  const isEdit = container !== undefined;

  const spec = metadataSpec(definition, labels, pluginId);
  const metadataShape = buildFormSchemaFromSpec(
    spec,
    container?.metadata,
  ).shape;

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

  const formSchema = z.object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(CONTENT_CONTAINER_NAME_MAX_LENGTH)
      .default(container?.name ?? ""),
    slug: z
      .string()
      .trim()
      .max(CONTENT_CONTAINER_SLUG_MAX_LENGTH)
      .default(container?.slug ?? ""),
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
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    form,
  ) => {
    const { name, slug, ...rest } = values as Record<string, unknown> & {
      name: string;
      slug: string;
    };
    const parentId = showParent
      ? ((rest.parentId as null | number | undefined) ?? null)
      : null;
    const body: ContentContainerWriteBody = {
      metadata: metadataForApi(spec.fields, rest),
      name,
      ...(slug === "" ? {} : { slug }),
    };

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
        name: result.data?.name ?? name,
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

  return (
    <AutoForm
      className="flex min-h-0 flex-1 flex-col gap-0"
      fields={[
        {
          component: props => (
            <AutoFormInput
              {...props}
              autoComplete="off"
              label={t("form.name")}
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
                    description={t("form.parentDesc", {
                      max: rules.maxDepth,
                    })}
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
        ...metadataFields,
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-5">
            {rendered.name}
            {rendered.slug}
            {showParent ? rendered.parentId : null}
            {spec.fields.length > 0 ? (
              <section
                aria-label={t("form.fields")}
                className="flex flex-col gap-5 border-t pt-5"
              >
                {spec.fields.map(fieldSpec => (
                  <div className="flex flex-col gap-2" key={fieldSpec.name}>
                    {rendered[fieldSpec.name]}
                  </div>
                ))}
              </section>
            ) : null}
          </div>
          <AutoFormSheetFooter
            submitLabel={t(isEdit ? "edit.submit" : "create.submit")}
          />
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};
