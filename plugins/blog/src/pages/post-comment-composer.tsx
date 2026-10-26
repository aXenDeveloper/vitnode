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
import { CheckIcon, SendHorizontalIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

import { useCommentRejection } from "./post-comment-errors";

const COMMENT_FORM_FIELDS = ["body"] as const;

export type PostCommentComposerProps = {
  autoFocus?: boolean;
  label: string;
  onCancel?: () => void;
  onDone: (outcome: { pending: boolean }) => void;
} & (
  | {
      articleId: number;
      mode: "create";
      parentId: null | number;
    }
  | {
      commentId: number;
      defaultBody: RichTextDocument;
      expectedVersion: number;
      mode: "edit";
    }
);

const useCommentSchema = (defaultBody: RichTextDocument) => {
  const t = useTranslations("@vitnode/blog.comments.form");

  return z.object({
    body: zodRichTextDocument
      .refine(doc => !isRichTextEmpty(doc), t("body.required"))
      .default(defaultBody),
  });
};

type CommentSchema = ReturnType<typeof useCommentSchema>;

const PostCommentComposer = (props: PostCommentComposerProps) => {
  const { autoFocus, label, onCancel, onDone } = props;
  const t = useTranslations("@vitnode/blog.comments");
  const rejectComment = useCommentRejection(COMMENT_FORM_FIELDS);
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
          values: { article: props.articleId, body, parent: props.parentId },
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
            <AutoFormEditor
              {...fieldProps}
              format="json"
              label={label}
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
        <AutoFormSubmitButton>
          {props.mode === "edit" ? (
            <CheckIcon aria-hidden="true" />
          ) : (
            <SendHorizontalIcon aria-hidden="true" />
          )}
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

export default PostCommentComposer;
