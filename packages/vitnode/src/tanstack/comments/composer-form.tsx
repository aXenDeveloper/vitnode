import type { ContentId } from "@vitnode/api/content/ids";

import {
  emptyRichTextDocument,
  isRichTextEmpty,
  type RichTextDocument,
  zodRichTextDocument,
} from "@vitnode/api/content/rich-text";
import { CheckIcon, SendHorizontalIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import {
  AutoForm,
  type AutoFormOnSubmit,
  AutoFormSubmitButton,
} from "@/components/form/auto-form";
import { AutoFormEditor } from "@/components/form/fields/editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import type { ContentCommentWriteOutcome } from "./thread";
import type { ContentCommentEditable } from "./use-content-comments";

import { useContentPublicWrite } from "../content/public-write";
import { useContentCommentsContext } from "./root";

const FORM_FIELDS = ["body"] as const;

export type ContentCommentComposerFormProps = {
  /** Puts the cursor in the editor when it opens. */
  autoFocus?: boolean;
  hideLabel?: boolean;
  /** The editor's accessible name, already translated. */
  label: string;
  /** Shows **Cancel**, which calls it. */
  onCancel?: () => void;
  /**
   * Called after the server accepted the comment, with what it became and
   * its id (`null` when the answer carried none).
   */
  onDone?: (outcome: ContentCommentWriteOutcome, id: ContentId | null) => void;
  /**
   * Why this form can no longer be sent, already translated - e.g. the
   * comment it edits or answers was removed meanwhile. Keeps the editor and
   * its text, shows the reason and hides the submit button.
   */
  unavailable?: string;
} & (
  | { editable: ContentCommentEditable; id: ContentId; mode: "edit" }
  | {
      initialBody?: RichTextDocument;
      mode: "create";
      parentId: ContentId | null;
    }
);

const zodWrittenId = z.object({ id: z.union([z.number(), z.string()]) });

const useBodySchema = (defaultBody: RichTextDocument) => {
  const t = useTranslations("core.comments.form");

  return z.object({
    body: zodRichTextDocument
      .refine(doc => !isRichTextEmpty(doc), t("required"))
      .default(defaultBody),
  });
};

/**
 * The comment form: a new comment, a reply, or an edit. Sends through the
 * thread's own callbacks with `useContentPublicWrite`, so a refused write
 * keeps the text, shows the reason, and an edit with editorial revisions
 * shows the version-conflict alert. Lazy-loaded by `ContentCommentComposer`.
 */
const ContentCommentComposerForm = (props: ContentCommentComposerFormProps) => {
  const { autoFocus, hideLabel, label, onCancel, onDone, unavailable } = props;
  const t = useTranslations("core.comments");
  const { comments } = useContentCommentsContext();
  const editId = props.mode === "edit" ? props.id : null;
  const write = useContentPublicWrite({
    fields: FORM_FIELDS,
    latestVersion:
      props.mode === "edit" && props.editable.version !== undefined
        ? async () => {
            if (editId === null) return null;
            const result = await comments.loadEditable(editId);

            return result.ok ? (result.value.version ?? null) : null;
          }
        : undefined,
    version: props.mode === "edit" ? props.editable.version : undefined,
  });
  const formSchema = useBodySchema(
    props.mode === "edit"
      ? props.editable.body
      : (props.initialBody ?? emptyRichTextDocument()),
  );

  const announce = (
    outcome: ContentCommentWriteOutcome,
    id: ContentId | null,
  ) => {
    const key =
      props.mode === "edit"
        ? outcome === "pending"
          ? "edit_pending"
          : "edited"
        : outcome;
    const show = outcome === "published" ? toast.success : toast.info;
    show(t(`outcome.${key}.title`), {
      description: t(`outcome.${key}.desc`),
    });
    onDone?.(outcome, id);
  };

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    { body },
    form,
  ) => {
    const record = await write.submit(form, async expectedVersion =>
      props.mode === "edit"
        ? await comments.requestSave(props.id, { body, expectedVersion })
        : await comments.requestCreate({ body, parentId: props.parentId }),
    );
    if (!record) return;

    const outcome = await comments.written(record);
    if (props.mode === "create") form.reset();
    const written = zodWrittenId.safeParse(record);
    announce(outcome, written.success ? written.data.id : null);
  };

  return (
    <div className="flex flex-col gap-3">
      {unavailable ? (
        <Alert variant="destructive">
          <AlertDescription>{unavailable}</AlertDescription>
        </Alert>
      ) : null}
      {write.conflict}
      {props.mode === "edit" && props.editable.proposed ? (
        <Alert>
          <AlertDescription>{t("form.proposed")}</AlertDescription>
        </Alert>
      ) : null}
      <AutoForm
        aria-label={label}
        className="flex flex-col gap-3"
        fields={[
          {
            id: "body",
            component: fieldProps => (
              <AutoFormEditor
                {...fieldProps}
                format="json"
                label={label}
                labelClassName={hideLabel ? "sr-only" : undefined}
                onEditor={
                  autoFocus
                    ? editor => {
                        editor?.commands.focus("end");
                      }
                    : undefined
                }
              />
            ),
          },
        ]}
        formSchema={formSchema}
        layout={fields => <>{fields.body}</>}
        mode="onSubmit"
        onSubmit={onSubmit}
      >
        <div className="flex flex-wrap items-center gap-2">
          {unavailable ? null : (
            <AutoFormSubmitButton>
              {props.mode === "edit" ? (
                <CheckIcon aria-hidden="true" />
              ) : (
                <SendHorizontalIcon aria-hidden="true" />
              )}
              {props.mode === "edit" ? t("form.save") : t("form.submit")}
            </AutoFormSubmitButton>
          )}
          {onCancel ? (
            <Button onClick={onCancel} type="button" variant="ghost">
              {t("form.cancel")}
            </Button>
          ) : null}
        </div>
      </AutoForm>
    </div>
  );
};

export default ContentCommentComposerForm;
