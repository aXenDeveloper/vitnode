// No "use client" here on purpose: this module is only reached from
// `create-action`/`edit-action`, which are already client entries. Declaring
// it again would make this a nested client entry, and `next/dynamic` cannot
// resolve one from inside a published package - the dialog spins forever.
import { useLocale, useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormSpec } from "@/content/admin/spec";
import type { ContentFileFieldValue } from "@/content/files";
import type { ContentFormLayout } from "@/lib/plugin";

import { AutoForm, type AutoFormOnSubmit } from "@/components/form/auto-form";
import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { useDialog } from "@/components/ui/dialog";
import { Loader } from "@/components/ui/loader";
import {
  buildFormSchemaFromSpec,
  contentFormInitialValues,
  contentFormValuesToPayload,
  contentFormValuesToTranslations,
  contentLocalizedFieldNames,
  contentTitleFromValues,
  isCollectionFieldSpec,
} from "@/content/admin/spec";
import { uploadContentFile } from "@/content/admin/upload";
import { CONTENT_PERMISSIONS } from "@/content/const";
import { usePathname, useRouter } from "@/lib/navigation";

import type { ContentFormHeaderValue } from "../form/context";
import type { ContentConflictState } from "./conflict-notice";
import type { TranslationRow } from "./translation-api.server";

import { ContentFormProvider } from "../form/context";
import { ContentFormHeader } from "../form/primitives";
import { ContentFormPublication } from "../form/publication-status";
import { ContentFormSections } from "../form/sections";
import { ContentField } from "../lib/field-component";
import { contentErrorKey } from "../lib/mutation-feedback";
import { useInvalidateContentOptions } from "../lib/options-query";
import { ConflictNotice } from "./conflict-notice";
import {
  createContentAction,
  createLocalizedContentAction,
  editContentAction,
  editLocalizedContentAction,
  loadContentOptionsAction,
  publishContentAction,
  reloadContentRowAction,
  unpublishContentAction,
} from "./mutation-api.server";
import { listContentTranslationsAction } from "./translation-api.server";

/**
 * The collection fields of a row that are not on it.
 *
 * A repeatable, a to-many reference and a gallery are all stored on tables of
 * their own, so the admin *list* deliberately leaves them off its rows -
 * carrying them would cost queries per page for values no column renders. A
 * dialog-mode form is handed one of those rows, and a form that opened on the
 * empty set for each would show an article with no categories, no gallery, and
 * then **save it that way**.
 *
 * Empty for a page-mode form, whose server component read the record's detail
 * and already has them - so the common case costs no request at all.
 */
const missingCollections = (
  spec: ContentFormSpec,
  data: Record<string, unknown>,
): string[] =>
  spec.fields
    .filter(isCollectionFieldSpec)
    .map(field => field.name)
    .filter(name => !Array.isArray(data[name]));

export interface ContentFormProps {
  data?: Record<string, unknown> & { id: number };
  fieldOverrides?: Record<
    string,
    (props: ItemAutoFormComponentProps) => React.ReactNode
  >;
  header?: ContentFormHeaderValue;
  layout?: ContentFormLayout;
  onCreated?: (id: number) => void;
  presentation?: "dialog" | "page";
  publication?: boolean;
  singular: string;
  spec: ContentFormSpec;
  title?: string;
  translations?: readonly TranslationRow[];
}

export const ContentForm = ({
  data,
  spec,
  translations,
  ...props
}: ContentFormProps) => {
  const localized = spec.defaultLocale !== null;
  const [loaded, setLoaded] = React.useState<null | readonly TranslationRow[]>(
    translations ?? (localized && data ? null : []),
  );
  const [reloaded, setReloaded] = React.useState<null | {
    for: NonNullable<ContentFormProps["data"]>;
    row: NonNullable<ContentFormProps["data"]>;
  }>(null);
  const row: ContentFormProps["data"] =
    data === undefined || missingCollections(spec, data).length === 0
      ? data
      : reloaded?.for === data
        ? reloaded.row
        : undefined;

  const contentTypeId = spec.contentTypeId;
  const itemId = data?.id;
  const pendingRow = data !== undefined && row === undefined;

  React.useEffect(() => {
    if (loaded !== null || itemId === undefined) return;

    let active = true;

    void listContentTranslationsAction(contentTypeId, itemId).then(
      ({ edges }) => {
        if (active) setLoaded(edges);
      },
    );

    return () => {
      active = false;
    };
  }, [contentTypeId, itemId, loaded]);

  React.useEffect(() => {
    if (!pendingRow || data === undefined) return;

    let active = true;

    void reloadContentRowAction(contentTypeId, data.id).then(
      ({ row: fresh }) => {
        if (active) {
          setReloaded({ for: data, row: fresh ? { ...data, ...fresh } : data });
        }
      },
    );

    return () => {
      active = false;
    };
  }, [contentTypeId, data, pendingRow]);

  if (loaded === null || pendingRow) return <Loader />;

  return (
    <ContentFormFields
      data={row}
      spec={spec}
      translations={loaded}
      {...props}
    />
  );
};

const ContentFormFields = ({
  data,
  fieldOverrides = {},
  header,
  layout,
  onCreated,
  presentation = "dialog",
  publication = false,
  singular,
  spec,
  title,
  translations = [],
}: ContentFormProps) => {
  const t = useTranslations("core.content");
  const tErrors = useTranslations("core.global.errors");
  const tContentErrors = useTranslations("core.content.errors");
  const { setOpen } = useDialog();
  const { push } = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const invalidateOptions = useInvalidateContentOptions();
  const canPublish = useAdminStaffPermission({
    module: spec.permissionModule,
    permission: CONTENT_PERMISSIONS.publish,
    plugin: spec.pluginId,
  });
  const [conflict, setConflict] = React.useState<ContentConflictState | null>(
    null,
  );

  const files = data?.files as
    Record<string, ContentFileFieldValue> | undefined;

  const localizedFields = React.useMemo(
    () => contentLocalizedFieldNames(spec),
    [spec],
  );
  const localized = localizedFields.length > 0;

  const [expectedVersion, setExpectedVersion] = React.useState(() =>
    typeof data?.version === "number" ? data.version : undefined,
  );
  const serverVersion =
    typeof data?.version === "number" ? data.version : undefined;
  if (
    serverVersion !== undefined &&
    expectedVersion !== undefined &&
    serverVersion > expectedVersion
  ) {
    setExpectedVersion(serverVersion);
  }

  const [opened, setOpened] = React.useState(() => translations);

  const values = React.useMemo(
    () => contentFormInitialValues(spec, data, opened),
    [spec, data, opened],
  );

  const formSchema = React.useMemo(
    () => buildFormSchemaFromSpec(spec, values),
    [spec, values],
  );

  const onReload = async () => {
    const { row } = await reloadContentRowAction(
      spec.contentTypeId,
      data?.id ?? 0,
    );
    if (!row) return;

    setConflict({
      currentVersion: typeof row.version === "number" ? row.version : 0,
      latest: row,
    });
    if (typeof row.version === "number") setExpectedVersion(row.version);
  };

  const translationPayload = (submitted: Record<string, unknown>) => {
    const byLocale = contentFormValuesToTranslations(spec, submitted);
    const entries: {
      expectedVersion?: number;
      locale: string;
      values: Record<string, unknown>;
    }[] = [];

    for (const [code, next] of Object.entries(byLocale)) {
      const existing = opened.find(
        row => row.locale.toLowerCase() === code.toLowerCase(),
      );

      if (!existing) {
        entries.push({ locale: code, values: next });
        continue;
      }

      const changed = Object.fromEntries(
        Object.entries(next).filter(
          ([name, value]) => existing.values[name] !== value,
        ),
      );
      if (Object.keys(changed).length === 0) continue;

      entries.push({
        expectedVersion: existing.version,
        locale: existing.locale,
        values: changed,
      });
    }

    return entries;
  };

  const sharedChanged = (payload: Record<string, unknown>): boolean => {
    if (!data) return true;

    return Object.entries(payload).some(([name, value]) => {
      const before = data[name];

      if (Array.isArray(before) && Array.isArray(value)) {
        return (
          before.length !== value.length ||
          before.some((item, index) => item !== value[index])
        );
      }

      return before !== value;
    });
  };

  const transition = async (action: "publish" | "unpublish") => {
    if (!data) return false;

    const mutation =
      action === "publish"
        ? await publishContentAction(spec.contentTypeId, data.id)
        : await unpublishContentAction(spec.contentTypeId, data.id);

    if (mutation.error !== undefined) {
      const errorKey = contentErrorKey(mutation.status, mutation);

      toast.error(tErrors("title"), {
        description: errorKey
          ? tContentErrors(errorKey)
          : tErrors("internal_server_error"),
      });

      return false;
    }

    if (mutation.version !== undefined) setExpectedVersion(mutation.version);

    toast.success(t(`${action}.success`, { name: singular }), {
      description: title,
    });
    push(pathname);

    return true;
  };

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    submitted,
    _form,
    { intent },
  ) => {
    const payload = contentFormValuesToPayload(spec, submitted);

    const mutation = localized
      ? data
        ? await editLocalizedContentAction(
            spec.contentTypeId,
            data.id,
            sharedChanged(payload) ? payload : undefined,
            translationPayload(submitted),
            expectedVersion,
          )
        : await createLocalizedContentAction(
            spec.contentTypeId,
            payload,
            translationPayload(submitted),
          )
      : data
        ? await editContentAction(
            spec.contentTypeId,
            data.id,
            payload,
            expectedVersion,
          )
        : await createContentAction(spec.contentTypeId, payload);

    if (mutation.error !== undefined) {
      if (mutation.conflict?.code === "CONTENT_VERSION_CONFLICT") {
        setConflict({ currentVersion: mutation.conflict.currentVersion });

        return;
      }

      if (mutation.translationConflict) {
        toast.error(tErrors("title"), {
          description: t("translations.errors.version_conflict"),
        });

        return;
      }

      const errorKey = contentErrorKey(mutation.status, mutation);

      toast.error(tErrors("title"), {
        description: errorKey
          ? tContentErrors(errorKey)
          : tErrors("internal_server_error"),
      });

      return;
    }

    if (mutation.unchanged) {
      toast.info(t("edit.unchanged"));

      return;
    }

    if (mutation.version !== undefined) setExpectedVersion(mutation.version);

    invalidateOptions(spec.contentTypeId);

    const toastTitle =
      contentTitleFromValues(spec, submitted, locale) ??
      title ??
      t("create.desc", { name: singular });

    const published =
      !data &&
      intent === "publish" &&
      publication &&
      canPublish &&
      mutation.id !== undefined
        ? await publishContentAction(spec.contentTypeId, mutation.id)
        : null;

    if (published?.error !== undefined) {
      const errorKey = contentErrorKey(published.status, published);

      toast.success(t("create.success", { name: singular }), {
        description: toastTitle,
      });
      toast.error(tErrors("title"), {
        description: errorKey
          ? tContentErrors(errorKey)
          : tErrors("internal_server_error"),
      });
    } else {
      toast.success(
        t(
          published
            ? "publish.success"
            : data
              ? "edit.success"
              : "create.success",
          { name: singular },
        ),
        { description: toastTitle },
      );
    }

    if (presentation === "page") {
      if (!data && mutation.id !== undefined) {
        onCreated?.(mutation.id);

        return;
      }

      setOpened(mutation.translations ?? opened);
      push(pathname);

      return;
    }

    setOpen?.(false);
    push(pathname);
  };

  const fields = spec.fields.map(
    (
      fieldSpec,
    ): {
      component: (props: ItemAutoFormComponentProps) => React.ReactNode;
      id: string;
    } => ({
      id: fieldSpec.name,

      // MUST NOT be async: `AutoForm` calls this to get an element, and an
      // async function hands it a fresh Promise every render - React 19
      // suspends on promise children, so the dialog spins forever.
      // eslint-disable-next-line @typescript-eslint/promise-function-async -- see above
      component: props => {
        const override = fieldOverrides[fieldSpec.name];
        if (override) {
          return override({
            ...props,
            multiLang: fieldSpec.localized === true,
          });
        }

        return (
          <ContentField
            files={files}
            loadOptions={async ({ field, ids, search }) =>
              await loadContentOptionsAction(
                spec.contentTypeId,
                field,
                search,
                ids,
              )
            }
            spec={fieldSpec}
            uploadFile={async ({ field, file }) =>
              await uploadContentFile({ field, file, spec })
            }
            {...props}
          />
        );
      },
    }),
  );

  const Layout = layout;
  const sections = Layout ? [] : spec.sections;

  return (
    <>
      {conflict && data ? (
        <ConflictNotice
          conflict={conflict}
          name={singular}
          onDismiss={() => setConflict(null)}
          onReload={onReload}
          opened={data}
          spec={spec}
        />
      ) : null}

      <AutoForm
        fields={fields}
        formSchema={formSchema}
        layout={renderedFields => (
          <ContentFormProvider
            value={{
              fieldNames: spec.fields.map(field => field.name),
              fields: renderedFields,
              header: presentation === "page" ? header : undefined,
              localizedFieldNames: localizedFields,
              mode: data ? "edit" : "create",
              publication: {
                canPublish,
                enabled: publication,
                publishedAt: data?.publishedAt,
                status: data?.status,
                transition: data ? transition : undefined,
              },
              singular,
              title,
            }}
          >
            {Layout ? (
              <Layout
                contentTypeId={spec.contentTypeId}
                itemId={data?.id}
                mode={data ? "edit" : "create"}
                pluginId={spec.pluginId}
                publication={publication}
                singular={singular}
                title={title}
              />
            ) : (
              <>
                <ContentFormHeader />

                {publication && data ? (
                  <ContentFormPublication
                    publishedAt={data.publishedAt}
                    status={data.status}
                  />
                ) : null}

                <ContentFormSections sections={sections} />
              </>
            )}
          </ContentFormProvider>
        )}
        onSubmit={onSubmit}
      />
    </>
  );
};
