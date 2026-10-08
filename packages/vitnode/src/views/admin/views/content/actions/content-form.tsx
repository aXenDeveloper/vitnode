import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormSpec } from "@/content/admin/spec";
import type { ContentFileFieldValue } from "@/content/files";
import type { ContentFormLayout } from "@/lib/plugin";

import { AutoForm, type AutoFormOnSubmit } from "@/components/form/auto-form";
import { MultiLangDefaultLanguageContext } from "@/components/form/fields/multi-lang-default-language";
import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { useDialog } from "@/components/ui/dialog";
import {
  buildFormSchemaFromSpec,
  contentFormInitialValues,
  contentFormValuesToPayload,
  contentLocalizedFieldNames,
  contentTitleFromValues,
} from "@/content/admin/spec";
import { uploadContentFile } from "@/content/admin/upload";
import { CONTENT_PERMISSIONS } from "@/content/const";

import type { TranslationRow } from "../content-mutation";
import type { ContentFormHeaderValue } from "../form/context";
import type { ContentFormSkeletonOverrides } from "../form/skeleton";
import type { ContentOptionsLoader } from "../lib/field-component";
import type { ContentLiveFormState } from "../live/root";
import type { ContentConflictState } from "./conflict-notice";

import { ContentFormProvider } from "../form/context";
import {
  contentSharedChanged,
  contentTranslationDiff,
  missingContentCollections,
} from "../form/diff";
import { ContentFormHeader } from "../form/layout-primitives";
import { useContentFormNavigation } from "../form/navigation";
import { ContentFormPublication } from "../form/publication-status";
import { ContentFormSections } from "../form/sections";
import {
  ContentFormSkeleton,
  contentSpecSkeletonShape,
} from "../form/skeleton";
import { useContentFormTransport } from "../form/transport";
import { ContentField } from "../lib/field-component";
import { contentErrorKey } from "../lib/mutation-feedback";
import { useInvalidateContentOptions } from "../lib/options-query";
import { ContentLiveField } from "../live/field";
import { ContentLiveRoot } from "../live/root";
import { ContentLiveStatus } from "../live/status";
import { overlayContentDrafts } from "../live/values";
import { ConflictNotice } from "./conflict-notice";

export interface ContentFormProps {
  data?: Record<string, unknown> & { id: number };
  fieldOverrides?: Record<
    string,
    (props: ItemAutoFormComponentProps) => React.ReactNode
  >;
  fieldSkeletons?: ContentFormSkeletonOverrides;
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
  fieldSkeletons,
  spec,
  translations,
  ...props
}: ContentFormProps) => {
  const transport = useContentFormTransport();
  const localized = spec.defaultLocale !== null;
  const [loaded, setLoaded] = React.useState<null | readonly TranslationRow[]>(
    translations ?? (localized && data ? null : []),
  );
  const [reloaded, setReloaded] = React.useState<null | {
    for: NonNullable<ContentFormProps["data"]>;
    row: NonNullable<ContentFormProps["data"]>;
  }>(null);
  const row: ContentFormProps["data"] =
    data === undefined || missingContentCollections(spec, data).length === 0
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

    void transport.listTranslations(contentTypeId, itemId).then(({ edges }) => {
      if (active) setLoaded(edges);
    });

    return () => {
      active = false;
    };
  }, [contentTypeId, itemId, loaded, transport]);

  React.useEffect(() => {
    if (!pendingRow || data === undefined) return;

    let active = true;

    void transport.reloadRow(contentTypeId, data.id).then(({ row: fresh }) => {
      if (active) {
        setReloaded({ for: data, row: fresh ? { ...data, ...fresh } : data });
      }
    });

    return () => {
      active = false;
    };
  }, [contentTypeId, data, pendingRow, transport]);

  const skeleton = (
    <ContentFormSkeleton
      contentTypeId={spec.contentTypeId}
      header={props.presentation === "page" ? props.header : undefined}
      layout={props.layout}
      mode={data ? "edit" : "create"}
      pluginId={spec.pluginId}
      publication={props.publication}
      shape={contentSpecSkeletonShape(spec, fieldSkeletons)}
      singular={props.singular}
      title={props.title}
    />
  );

  if (loaded === null || pendingRow) return skeleton;

  // Live editing (locks, the shared draft, autosave) needs a record version,
  // so it is an existing record of an editorial content type or nothing.
  if (row && spec.editorial === true) {
    return (
      <ContentLiveRoot
        data={row}
        fallback={skeleton}
        spec={spec}
        translations={loaded}
      >
        {live => (
          <ContentFormFields
            data={live.row}
            live={live}
            spec={spec}
            translations={live.translations}
            {...props}
          />
        )}
      </ContentLiveRoot>
    );
  }

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
  live,
  onCreated,
  presentation = "dialog",
  publication = false,
  singular,
  spec,
  title,
  translations = [],
}: ContentFormProps & {
  /** The shared draft the form opens on, when the record is edited live. */
  live?: ContentLiveFormState;
}) => {
  const t = useTranslations("core.content");
  const tErrors = useTranslations("core.global.errors");
  const tContentErrors = useTranslations("core.content.errors");
  const { setOpen } = useDialog();
  const { refresh } = useContentFormNavigation();
  const transport = useContentFormTransport();
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
    | Record<string, ContentFileFieldValue>
    | undefined;

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

  const drafts = live?.drafts ?? null;
  const draftLabels = live?.labels;
  const values = React.useMemo(() => {
    if (!data || !drafts) return contentFormInitialValues(spec, data, opened);

    // The draft only changes what the form opens on. `data` and `opened` stay
    // the committed record, so Save still sees every drafted value as a change.
    const overlaid = overlayContentDrafts(data, opened, drafts, draftLabels);

    return contentFormInitialValues(spec, overlaid.data, overlaid.translations);
  }, [spec, data, opened, drafts, draftLabels]);

  const formSchema = React.useMemo(
    () => buildFormSchemaFromSpec(spec, values),
    [spec, values],
  );

  const loadOptions = React.useCallback<ContentOptionsLoader>(
    async ({ field, ids, search }) =>
      await transport.loadOptions(spec.contentTypeId, field, search, ids),
    [spec.contentTypeId, transport],
  );

  const onReload = async () => {
    const { row } = await transport.reloadRow(
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

  const translationPayload = (submitted: Record<string, unknown>) =>
    contentTranslationDiff(spec, submitted, opened);

  const transition = async (action: "publish" | "unpublish") => {
    if (!data) return false;

    const mutation =
      action === "publish"
        ? await transport.publish(spec.contentTypeId, data.id)
        : await transport.unpublish(spec.contentTypeId, data.id);

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

    const savedId = mutation.id ?? data?.id;
    if (savedId !== undefined) {
      await Promise.allSettled(
        [...savedListenersRef.current].map(async listener => {
          await listener({ itemId: savedId });
        }),
      );
    }

    toast.success(t(`${action}.success`, { name: singular }), {
      description: title,
    });
    refresh();

    return true;
  };

  const savedListenersRef = React.useRef(
    new Set<(saved: { itemId: number }) => Promise<void> | void>(),
  );
  const onSaved = React.useCallback(
    (listener: (saved: { itemId: number }) => Promise<void> | void) => {
      savedListenersRef.current.add(listener);

      return () => {
        savedListenersRef.current.delete(listener);
      };
    },
    [],
  );

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    submitted,
    _form,
    { intent },
  ) => {
    const payload = contentFormValuesToPayload(spec, submitted);

    const mutation = localized
      ? data
        ? await transport.editLocalized(
            spec.contentTypeId,
            data.id,
            contentSharedChanged(data, payload) ? payload : undefined,
            translationPayload(submitted),
            expectedVersion,
          )
        : await transport.createLocalized(
            spec.contentTypeId,
            payload,
            translationPayload(submitted),
          )
      : data
        ? await transport.edit(
            spec.contentTypeId,
            data.id,
            payload,
            expectedVersion,
          )
        : await transport.create(spec.contentTypeId, payload);

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
        ? await transport.publish(spec.contentTypeId, mutation.id)
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
      refresh();

      return;
    }

    setOpen?.(false);
    refresh();
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
      component: props => {
        const Override = fieldOverrides[fieldSpec.name];

        // A no-op outside a live session; inside one it holds the field's lock.
        return (
          <ContentLiveField field={props.field} fieldSpec={fieldSpec}>
            {Override ? (
              <Override {...props} multiLang={fieldSpec.localized === true} />
            ) : (
              <ContentField
                files={files}
                loadOptions={loadOptions}
                spec={fieldSpec}
                uploadFile={async ({ field, file }) =>
                  await uploadContentFile({ field, file, spec })
                }
                {...props}
              />
            )}
          </ContentLiveField>
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

      <MultiLangDefaultLanguageContext value={spec.defaultLocale}>
        <AutoForm
          fields={fields}
          formSchema={formSchema}
          layout={renderedFields => (
            <ContentFormProvider
              value={{
                defaultLocale: spec.defaultLocale,
                fieldNames: spec.fields.map(field => field.name),
                fields: renderedFields,
                files,
                header: presentation === "page" ? header : undefined,
                localizedFieldNames: localizedFields,
                mode: data ? "edit" : "create",
                onSaved,
                publication: {
                  canPublish,
                  enabled: publication,
                  publishedAt: data?.publishedAt,
                  status: data?.status,
                  transition: data ? transition : undefined,
                },
                singular,
                title,
                translations: opened.map(row => ({
                  locale: row.locale,
                  status: row.status,
                  updatedAt: row.updatedAt,
                })),
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
                  {presentation === "page" ? null : <ContentLiveStatus />}

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
      </MultiLangDefaultLanguageContext>
    </>
  );
};
