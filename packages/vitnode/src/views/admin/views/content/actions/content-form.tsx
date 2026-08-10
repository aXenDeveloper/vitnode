// No "use client" here on purpose: this module is only reached from
// `create-action`/`edit-action`, which are already client entries. Declaring
// it again would make this a nested client entry, and `next/dynamic` cannot
// resolve one from inside a published package - the dialog spins forever.
import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormSpec } from "@/content/admin/spec";
import type { ContentFormLayout } from "@/lib/plugin";

import { AutoForm, type AutoFormOnSubmit } from "@/components/form/auto-form";
import { useDialog } from "@/components/ui/dialog";
import {
  buildFormSchemaFromSpec,
  contentFormValuesToPayload,
  contentTitleFromValues,
} from "@/content/admin/spec";
import { usePathname, useRouter } from "@/lib/navigation";

import type { ContentConflictState } from "./conflict-notice";

import { ContentFormProvider } from "../form/context";
import { ContentFormPublication } from "../form/publication-status";
import { ContentField } from "../lib/field-component";
import { contentErrorKey } from "../lib/mutation-feedback";
import { ConflictNotice } from "./conflict-notice";
import {
  createContentAction,
  editContentAction,
  loadContentOptionsAction,
  reloadContentRowAction,
} from "./mutation-api.server";

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
}

export const ContentForm = ({
  data,
  fieldOverrides = {},
  layout,
  onCreated,
  presentation = "dialog",
  publication = false,
  singular,
  spec,
  title,
}: ContentFormProps) => {
  const t = useTranslations("core.content");
  const tErrors = useTranslations("core.global.errors");
  const tContentErrors = useTranslations("core.content.errors");
  const { setOpen } = useDialog();
  const { push } = useRouter();
  const pathname = usePathname();
  const [conflict, setConflict] = React.useState<ContentConflictState | null>(
    null,
  );

  // The version this form opened with, and the one every save is checked
  // against - until a conflict is resolved, which replaces it with the version
  // the editor has now actually seen.
  const [expectedVersion, setExpectedVersion] = React.useState(() =>
    typeof data?.version === "number" ? data.version : undefined,
  );

  const formSchema = React.useMemo(
    () => buildFormSchemaFromSpec(spec, data),
    [spec, data],
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

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    // Relation and user fields hold the whole combobox option; the API wants
    // the identifier.
    const payload = contentFormValuesToPayload(spec, values);

    const mutation = data
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

    toast.success(
      t(data ? "edit.success" : "create.success", { name: singular }),
      {
        // On create there is no row yet, so the toast names what was typed.
        description:
          title ??
          contentTitleFromValues(spec, values) ??
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
        if (override) return override(props);

        return (
          <ContentField
            loadOptions={async ({ field, search }) =>
              await loadContentOptionsAction(spec.contentTypeId, field, search)
            }
            spec={fieldSpec}
            {...props}
          />
        );
      },
    }),
  );

  const Layout = layout;

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
          onReload={onReload}
          opened={data}
          spec={spec}
        />
      ) : null}

      <AutoForm
        fields={fields}
        formSchema={formSchema}
        layout={
          Layout
            ? renderedFields => (
                <ContentFormProvider
                  value={{
                    fieldNames: spec.fields.map(field => field.name),
                    fields: renderedFields,
                    mode: data ? "edit" : "create",
                    publication: {
                      enabled: publication,
                      publishedAt: data?.publishedAt,
                      status: data?.status,
                    },
                    surface: "shared",
                  }}
                >
                  <Layout
                    contentTypeId={spec.contentTypeId}
                    itemId={data?.id}
                    mode={data ? "edit" : "create"}
                    pluginId={spec.pluginId}
                    publication={publication}
                    singular={singular}
                    surface="shared"
                    title={title}
                  />
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
