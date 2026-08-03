// No "use client" here on purpose: this module is only reached from
// `create-action`/`edit-action`, which are already client entries. Declaring
// it again would make this a nested client entry, and `next/dynamic` cannot
// resolve one from inside a published package - the dialog spins forever.
import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormSpec } from "@/content/admin/spec";

import { AutoForm, type AutoFormOnSubmit } from "@/components/form/auto-form";
import { useDialog } from "@/components/ui/dialog";
import {
  buildFormSchemaFromSpec,
  contentFormValuesToPayload,
  contentTitleFromValues,
} from "@/content/admin/spec";
import { usePathname, useRouter } from "@/lib/navigation";

import { ContentField } from "../lib/field-component";
import { contentErrorKey } from "../lib/mutation-feedback";
import {
  createContentAction,
  editContentAction,
  loadContentOptionsAction,
} from "./mutation-api.server";

export interface ContentFormProps {
  /** Existing values when editing; absent when creating. */
  data?: Record<string, unknown> & { id: number };
  /** Per-field component overrides declared in `buildPlugin`. */
  fieldOverrides?: Record<
    string,
    (props: ItemAutoFormComponentProps) => React.ReactNode
  >;
  /** The content type's singular label, used in the success toast. */
  singular: string;
  spec: ContentFormSpec;
  /** Resolved title of the row, shown as the toast description. */
  title?: string;
}

export const ContentForm = ({
  data,
  fieldOverrides = {},
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

  const formSchema = React.useMemo(
    () => buildFormSchemaFromSpec(spec, data),
    [spec, data],
  );

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    // Relation and user fields hold the whole combobox option; the API wants
    // the identifier.
    const payload = contentFormValuesToPayload(spec, values);

    const mutation = data
      ? await editContentAction(spec.contentTypeId, data.id, payload)
      : await createContentAction(spec.contentTypeId, payload);

    if (mutation.error !== undefined) {
      // A validation failure, a conflicting row and a server fault all need
      // different words - and none of them may quote the database.
      const errorKey = contentErrorKey(mutation.status);

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

    // Close first, then navigate: a refresh fired while the dialog is still
    // animating out leaves its overlay stranded over the page.
    setOpen?.(false);
    push(pathname);
  };

  return (
    <AutoForm
      fields={spec.fields.map(fieldSpec => ({
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
                await loadContentOptionsAction(
                  spec.contentTypeId,
                  field,
                  search,
                )
              }
              spec={fieldSpec}
              {...props}
            />
          );
        },
      }))}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{
        children: t(data ? "edit.submit" : "create.submit"),
      }}
    />
  );
};
