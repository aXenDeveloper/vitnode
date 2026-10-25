import {
  AutoForm,
  type AutoFormOnSubmit,
  AutoFormSubmitButton,
} from "@vitnode/core/components/form/auto-form";
import { AutoFormEditor } from "@vitnode/core/components/form/fields/editor";
import {
  emptyRichTextDocument,
  isRichTextEmpty,
  zodRichTextDocument,
} from "@vitnode/core/content";
import { useContentPublicWrite } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

/** Where a new comment ended up. Only `published` is in the public thread. */
export type CommentOutcome = "draft" | "pending" | "published";

export interface CommentComposerProps {
  articleId: number;
  label: string;
  /** Called after the server stored the comment. */
  onPosted: (outcome: CommentOutcome) => Promise<void>;
  /** The comment being answered, or `null` for the article itself. */
  parentId: null | number;
}

const createSchema = (required: string) =>
  z.object({
    body: zodRichTextDocument
      .refine(doc => !isRichTextEmpty(doc), required)
      .default(emptyRichTextDocument()),
  });

const CommentComposer = ({
  articleId,
  label,
  onPosted,
  parentId,
}: CommentComposerProps) => {
  const t = useTranslations("newsroom.comments.form");
  const write = useContentPublicWrite({ fields: ["body"] });

  const onSubmit: AutoFormOnSubmit<ReturnType<typeof createSchema>> = async (
    { body },
    form,
  ) => {
    const record = await write.submit(
      form,
      async () =>
        await fetcher({
          plugin: manifest.id,
          method: "post",
          module: "content/comments",
          path: "/",
          args: {
            body: { values: { article: articleId, body, parent: parentId } },
          },
        }),
    );
    if (!record) return;

    // A pending comment is a draft too, so ask about approval first.
    await onPosted(
      record.approval?.status === "pending"
        ? "pending"
        : record.status === "published"
          ? "published"
          : "draft",
    );
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
      formSchema={createSchema(t("required"))}
      layout={fields => <>{fields.body}</>}
      onSubmit={onSubmit}
    >
      <AutoFormSubmitButton className="self-start">
        {t("submit")}
      </AutoFormSubmitButton>
    </AutoForm>
  );
};

export default CommentComposer;
