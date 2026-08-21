// No "use client" here on purpose: this module is only reached from
// `create-action`/`edit-action`, which are already client entries. Declaring
// it again would make this a nested client entry, and `next/dynamic` cannot
// resolve one from inside a published package - the dialog spins forever.
import { useLocale, useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormSpec } from "@/content/admin/spec";
import type { ContentFileDescriptor } from "@/content/files";
import type { ContentFormLayout } from "@/lib/plugin";

import { AutoForm, type AutoFormOnSubmit } from "@/components/form/auto-form";
import { useDialog } from "@/components/ui/dialog";
import { Loader } from "@/components/ui/loader";
import {
  buildFormSchemaFromSpec,
  contentFormInitialValues,
  contentFormValuesToPayload,
  contentFormValuesToTranslations,
  contentLocalizedFieldNames,
  contentTitleFromValues,
  isReferenceKind,
} from "@/content/admin/spec";
import { uploadContentFile } from "@/content/admin/upload";
import { usePathname, useRouter } from "@/lib/navigation";

import type { ContentConflictState } from "./conflict-notice";
import type { TranslationRow } from "./translation-api.server";

import { ContentFormProvider } from "../form/context";
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
  reloadContentRowAction,
} from "./mutation-api.server";
import { listContentTranslationsAction } from "./translation-api.server";

/**
 * The collection fields of a row that are not on it.
 *
 * A to-many reference and a repeatable are stored on their own tables, so the
 * admin *list* deliberately leaves them off its rows - carrying them would cost
 * queries per page for values no column renders. A dialog-mode form is handed
 * one of those rows, and a form that opened on the empty set for each would show
 * an article with no categories and then save it that way.
 *
 * Empty for a page-mode form, whose server component read the record's detail
 * and already has them - so the common case costs no request at all.
 */
const missingCollections = (
  spec: ContentFormSpec,
  data: Record<string, unknown>,
): string[] =>
  spec.fields
    .filter(
      field =>
        field.kind === "repeatable" ||
        (isReferenceKind(field.kind) && field.multiple === true),
    )
    .map(field => field.name)
    .filter(name => !Array.isArray(data[name]));

export interface ContentFormProps {
  /** Existing values when editing; absent when creating. */
  data?: Record<string, unknown> & { id: number };
  /** Per-field component overrides declared in `buildPlugin`. */
  fieldOverrides?: Record<
    string,
    (props: ItemAutoFormComponentProps) => React.ReactNode
  >;
  /** Custom layout declared in `buildPlugin`. Presentation only. */
  layout?: ContentFormLayout;
  /**
   * Where a page-mode create hands the new record over. Ignored in a dialog,
   * which closes and refreshes the list instead.
   */
  onCreated?: (id: number) => void;
  /**
   * Where the form is. A dialog closes itself and refreshes the list behind it;
   * a page navigates instead, because there is nothing behind it to refresh.
   */
  presentation?: "dialog" | "page";
  /** Whether the content type has the draft/published lifecycle. */
  publication?: boolean;
  /** The content type's singular label, used in the success toast. */
  singular: string;
  spec: ContentFormSpec;
  /** Resolved title of the row, shown as the toast description. */
  title?: string;
  /**
   * Every translation the record already has, values included.
   *
   * Read once, in one query - so opening an article that exists in nine
   * languages costs one request rather than nine. Supplied by a page-mode form,
   * whose server component already did the read; a dialog loads it itself, since
   * there is no server render between the click and the form.
   *
   * Empty while creating, and empty for a content type that is not localized.
   */
  translations?: readonly TranslationRow[];
}

/**
 * Resolves the record's translations and its collections before the form is
 * built.
 *
 * The form's defaults are read from the schema exactly once, when `AutoForm`
 * mounts, so everything a field opens holding has to be in hand *before* that -
 * rendering an empty form and filling it in afterwards would fight
 * react-hook-form for the editor's first keystroke, and a `min: 1` field that
 * mounted on the empty set would leave Save disabled until it was re-picked.
 */
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
  // `undefined` while a row is still missing its collections, and the record
  // itself while creating - which is the same thing the form is handed then.
  const [row, setRow] = React.useState<ContentFormProps["data"]>(() =>
    data === undefined || missingCollections(spec, data).length === 0
      ? data
      : undefined,
  );

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

    // The detail read, which is the one that carries collections. Merged over
    // the list row rather than replacing it, so anything the table resolved for
    // the row - its labels - survives.
    void reloadContentRowAction(contentTypeId, data.id).then(
      ({ row: fresh }) => {
        if (active) setRow(fresh ? { ...data, ...fresh } : data);
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

/**
 * The generated create/edit form - one form, whatever a field is stored in.
 *
 * A localized field holds every language at once and renders its own small
 * language switcher, so the screen has no locale of its own: there is no
 * `Shared | English | Polish` strip, no locale in the URL, and no form-global
 * language state. Switching `Title` to English leaves the editor and the slug
 * exactly where they were, which is the point - a translator comparing one
 * heading against another should not have to move the whole page to do it.
 *
 * Every localized input starts in the language the person is already using
 * VitNode in, through `useMultiLangField`, which is the AdminCP's existing
 * behaviour and not a Content Engine invention.
 *
 * Saving is one request. Underneath it is still the Content Engine's
 * localization model - a base row, one translation row per language, each with
 * its own version - and the composite route writes all of them in one
 * transaction so a conflict in one language cannot leave another half-saved.
 */
const ContentFormFields = ({
  data,
  fieldOverrides = {},
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
  const [conflict, setConflict] = React.useState<ContentConflictState | null>(
    null,
  );

  /**
   * The record's already-stored file descriptors, keyed by field name.
   *
   * Carried beside the row by the generated detail and list responses rather
   * than folded into the column, so the form's *value* stays the identifier it
   * will submit while the uploader still has a name, a size and a URL to
   * preview. Empty while creating.
   */
  const files = data?.files as
    Record<string, ContentFileDescriptor | null> | undefined;

  const localizedFields = React.useMemo(
    () => contentLocalizedFieldNames(spec),
    [spec],
  );
  const localized = localizedFields.length > 0;

  /**
   * The version every save is checked against.
   *
   * It starts as the version the form opened with and then has to **keep up**,
   * which is the whole subtlety here: a page-mode form stays mounted across its
   * own saves, so holding the opening version for the life of the component
   * means the second save of a session guards on a version the record has
   * already left behind - and gets a conflict banner naming an editor who does
   * not exist.
   *
   * Two things move it, and each covers what the other misses:
   *
   * - the mutation result, immediately, which closes the window between a save
   *   returning and fresh server data arriving;
   * - a newer `data.version` from the server, which covers every *other* way the
   *   version moves while this form is open - a publish, an unpublish, a restore
   *   from the history dialog.
   *
   * Only ever forwards. A stale row - a dialog opened from a list rendered
   * before the last write - must not drag the precondition backwards, and a
   * conflict that has been reloaded must not be un-resolved by one.
   */
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
    // Derived from a prop during render on purpose: an effect would leave one
    // render - and therefore one possible submit - guarding on the old version.
    setExpectedVersion(serverVersion);
  }

  /**
   * What every language held when the form opened.
   *
   * Kept so the save can send **only** what moved: a Polish-only edit must not
   * bump the English translation's version, write an English revision or expire
   * the English cache. And each locale's own `version` travels with it, so two
   * translators editing two languages of the same record never contend.
   */
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
    // Saving again now overwrites what the editor has just been shown, which is
    // a decision they make by pressing the button a second time.
    if (typeof row.version === "number") setExpectedVersion(row.version);
  };

  /**
   * The per-language halves of this submit, each carrying the version it was
   * loaded at.
   *
   * A language is included only when something in it actually changed, and a
   * language nobody typed into is never included at all - selecting one to read
   * what is there must not create an empty translation.
   */
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

  /**
   * `true` when a shared field actually moved, so a no-op sends nothing.
   *
   * A to-many field is compared **by its contents**: its value is an array, and
   * the picker hands back a new one on every change - so reference equality
   * would call an untouched form changed the moment anything else re-rendered,
   * and would call a genuine reorder unchanged in neither direction reliably.
   * The identifiers in order are exactly what the API stores, so they are
   * exactly what "did this move?" should ask about.
   */
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

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async submitted => {
    // Relation and user fields hold the whole combobox option; the API wants
    // the identifier. Localized fields are split off here rather than in the
    // form, which is why a layout never has to know which table a field is on.
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
      // A lost update is the one failure with somewhere to go: the form stays
      // open with everything the editor typed, and the banner offers to show
      // what changed underneath them.
      if (mutation.conflict?.code === "CONTENT_VERSION_CONFLICT") {
        setConflict({ currentVersion: mutation.conflict.currentVersion });

        return;
      }

      // A translation conflict names the language it happened in, so the toast
      // can say which one rather than "something went wrong".
      if (mutation.translationConflict) {
        toast.error(tErrors("title"), {
          description: t("translations.errors.version_conflict"),
        });

        return;
      }

      // A validation failure, a conflicting row and a server fault all need
      // different words - and none of them may quote the database.
      const errorKey = contentErrorKey(mutation.status, mutation);

      toast.error(tErrors("title"), {
        description: errorKey
          ? tContentErrors(errorKey)
          : tErrors("internal_server_error"),
      });

      return;
    }

    // A save with nothing in it never reached the API, and saying "saved" for it
    // is how a form that is quietly dropping an edit looks identical to one that
    // is working. The editor is told what actually happened and left where they
    // are, with everything they typed still in front of them.
    if (mutation.unchanged) {
      toast.info(t("edit.unchanged"));

      return;
    }

    // The record just moved forward a version, and this form is still mounted -
    // so the next save has to guard on the version this one produced. Set before
    // the `push` below, because the fresh server row arrives asynchronously and a
    // second submit in between would otherwise send the version we just spent.
    if (mutation.version !== undefined) setExpectedVersion(mutation.version);

    // This record is somebody else's picker option. A new category has to appear
    // in the article form, and a renamed one has to read as its new name -
    // neither happens on its own, because the query client outlives the
    // navigation between the two screens.
    invalidateOptions(spec.contentTypeId);

    toast.success(
      t(data ? "edit.success" : "create.success", { name: singular }),
      {
        // On create there is no row yet, so the toast names what was typed - in
        // the language the editor is working in.
        description:
          contentTitleFromValues(spec, submitted, locale) ??
          title ??
          t("create.desc", { name: singular }),
      },
    );

    if (presentation === "page") {
      // A page has nothing behind it to refresh, so a create hands over to
      // whoever knows where the record should be opened next, and an edit stays
      // put with fresh server data.
      if (!data && mutation.id !== undefined) {
        onCreated?.(mutation.id);

        return;
      }

      // Every language just moved forward a version, and the next save has to
      // send the new ones. The page reload replaces `translations`, and this
      // keeps the form honest until it arrives.
      setOpened(mutation.translations ?? opened);
      push(pathname);

      return;
    }

    // Close first, then navigate: a refresh fired while the dialog is still
    // animating out leaves its overlay stranded over the page.
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
        // The override gets the same language-aware flag the generated input
        // would have, so a plugin that swaps in its own editor keeps the
        // switcher without re-deriving where the value is stored.
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
            // A plain client-side `fetch` of `multipart/form-data`, driven by
            // TanStack Query inside `AutoFormFile`. Deliberately **not** a Server
            // Action: a Server Action body is a serialised RSC payload, so an
            // image would cross as a string, buffered whole, under a platform
            // body limit that is not the field's `maxBytes`.
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
  // A plugin's own layout wins: it was written against these exact fields, and
  // `admin.form.sections` is the *generated* arrangement of them. Grouping is
  // still one `AutoForm` either way - the layout decides placement and nothing
  // else, so the submit path, the schema and the errors do not change with it.
  const sections = Layout ? [] : spec.sections;
  const grouped = sections.length > 0;

  return (
    <>
      {publication && data && !Layout ? (
        <ContentFormPublication
          publishedAt={data.publishedAt}
          status={data.status}
        />
      ) : null}

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
        layout={
          Layout || grouped
            ? renderedFields => (
                <ContentFormProvider
                  value={{
                    fieldNames: spec.fields.map(field => field.name),
                    fields: renderedFields,
                    localizedFieldNames: localizedFields,
                    mode: data ? "edit" : "create",
                    publication: {
                      enabled: publication,
                      publishedAt: data?.publishedAt,
                      status: data?.status,
                    },
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
                    <ContentFormSections sections={sections} />
                  )}
                </ContentFormProvider>
              )
            : undefined
        }
        onSubmit={onSubmit}
        submitButtonProps={{
          children: t(data ? "edit.submit" : "create.submit"),
        }}
      />
    </>
  );
};
