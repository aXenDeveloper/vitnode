import {
  AutoForm,
  type AutoFormOnSubmit,
  AutoFormSubmitButton,
} from "@vitnode/core/components/form/auto-form";
import { AutoFormEditor } from "@vitnode/core/components/form/fields/editor";
import { Button } from "@vitnode/core/components/ui/button";
import {
  emptyRichTextDocument,
  isRichTextEmpty,
  type RichTextDocument,
  zodRichTextDocument,
} from "@vitnode/core/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

import { useForumRejection } from "./forum-errors";

const COMMENT_FORM_FIELDS = ["body"] as const;

export type CommentComposerProps = {
  label: string;
  onCancel?: () => void;
  onDone: (outcome: { pending: boolean }) => void;
} & (
  | {
      commentId: number;
      defaultBody: RichTextDocument;
      expectedVersion: number;
      mode: "edit";
    }
  | { mode: "create"; parentId: null | number; topicId: number }
);

const useCommentSchema = (defaultBody: RichTextDocument) => {
  const t = useTranslations("@vitnode/forum.comments.form");

  return z.object({
    body: zodRichTextDocument
      .refine(doc => !isRichTextEmpty(doc), t("body.required"))
      .default(defaultBody),
  });
};

type CommentSchema = ReturnType<typeof useCommentSchema>;

const CommentComposer = (props: CommentComposerProps) => {
  const { label, onCancel, onDone } = props;
  const t = useTranslations("@vitnode/forum.comments");
  const rejectComment = useForumRejection(COMMENT_FORM_FIELDS);
  const formSchema = useCommentSchema(
    props.mode === "edit" ? props.defaultBody : emptyRichTextDocument(),
  );

  const announce = (pending: boolean, edited: boolean) => {
    if (pending) {
      toast.info(t("pending.title"), { description: t("pending.desc") });
    } else if (edited) {
      toast.success(t("edited.title"), { description: t("edited.desc") });
    } else {
      toast.success(t("created.title"), { description: t("created.desc") });
    }
    onDone({ pending });
  };

  const onSubmit: AutoFormOnSubmit<CommentSchema> = async ({ body }, form) => {
    if (props.mode === "edit") {
      const res = await fetcher({
        plugin: manifest.id,
        method: "patch",
        module: "content/comments",
        path: "/{id}",
        args: {
          params: { id: props.commentId },
          body: { values: { body }, expectedVersion: props.expectedVersion },
        },
      });

      if (res.status === 200) {
        const updated = await res.json();
        announce(updated.approval?.status === "pending", true);

        return;
      }

      if (res.status === 409) {
        toast.error(t("conflict.title"), { description: t("conflict.desc") });

        return;
      }

      await rejectComment(res, form);

      return;
    }

    const res = await fetcher({
      plugin: manifest.id,
      method: "post",
      module: "content/comments",
      path: "/",
      args: {
        body: {
          values: { body, parent: props.parentId, topic: props.topicId },
        },
      },
    });

    if (res.status === 201) {
      const record = await res.json();
      form.reset();
      announce(record.approval?.status === "pending", false);

      return;
    }

    await rejectComment(res, form);
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
      formSchema={formSchema}
      layout={fields => <>{fields.body}</>}
      onSubmit={onSubmit}
    >
      <div className="flex flex-wrap items-center gap-2">
        <AutoFormSubmitButton>
          {props.mode === "edit" ? t("form.save") : t("form.submit")}
        </AutoFormSubmitButton>
        {onCancel ? (
          <Button onClick={onCancel} type="button" variant="ghost">
            {t("form.cancel")}
          </Button>
        ) : null}
      </div>
    </AutoForm>
  );
};

export default CommentComposer;
