import {
  AutoForm,
  type AutoFormOnSubmit,
  AutoFormSubmitButton,
} from "@vitnode/core/components/form/auto-form";
import { AutoFormEditor } from "@vitnode/core/components/form/fields/editor";
import { Button } from "@vitnode/core/components/ui/button";
import {
  isRichTextEmpty,
  type RichTextDocument,
  zodRichTextDocument,
} from "@vitnode/core/content";
import { useContentPublicWrite } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

export interface CommentEditorProps {
  /** The comment's latest text, from `GET /comments/{id}/edit`. */
  body: RichTextDocument;
  commentId: number;
  label: string;
  onCancel: () => void;
  /** Called after a save, with whether it waits for a moderator. */
  onSaved: (pending: boolean) => Promise<void>;
}

const createSchema = (body: RichTextDocument, required: string) =>
  z.object({
    body: zodRichTextDocument
      .refine(doc => !isRichTextEmpty(doc), required)
      .default(body),
  });

const CommentEditor = ({
  body,
  commentId,
  label,
  onCancel,
  onSaved,
}: CommentEditorProps) => {
  const t = useTranslations("newsroom.comments.form");
  const write = useContentPublicWrite({ fields: ["body"] });

  const onSubmit: AutoFormOnSubmit<ReturnType<typeof createSchema>> = async (
    values,
    form,
  ) => {
    const saved = await write.submit(
      form,
      async () =>
        await fetcher({
          plugin: manifest.id,
          method: "patch",
          module: "content/comments",
          path: "/{id}",
          args: { params: { id: commentId }, body: { values } },
        }),
    );
    if (!saved) return;

    await onSaved(saved.approval?.status === "pending");
  };

  return (
    <AutoForm
      aria-label={label}
      className="flex flex-col gap-3"
      fields={[
        {
          id: "body",
          component: fieldProps => (
            <AutoFormEditor {...fieldProps} format="json" label={label} />
          ),
        },
      ]}
      formSchema={createSchema(body, t("required"))}
      layout={fields => <>{fields.body}</>}
      onSubmit={onSubmit}
    >
      <div className="flex flex-wrap items-center gap-2">
        <AutoFormSubmitButton>{t("save")}</AutoFormSubmitButton>
        <Button onClick={onCancel} type="button" variant="ghost">
          {t("cancel")}
        </Button>
      </div>
    </AutoForm>
  );
};

export default CommentEditor;
