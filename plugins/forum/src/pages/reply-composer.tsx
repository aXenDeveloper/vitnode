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

import { CONFIG_PLUGIN } from "@/const";

import { useForumRejection } from "./forum-errors";

const REPLY_FORM_FIELDS = ["body"] as const;

export type ReplyComposerProps = {
  label: string;
  onCancel?: () => void;
  onDone: (outcome: { pending: boolean }) => void;
} & (
  | {
      defaultBody: RichTextDocument;
      expectedVersion: number;
      mode: "edit";
      replyId: number;
    }
  | { mode: "create"; parentId: null | number; topicId: number }
);

const useReplySchema = (defaultBody: RichTextDocument) => {
  const t = useTranslations("@vitnode/forum.replies.form");

  return z.object({
    body: zodRichTextDocument
      .refine(doc => !isRichTextEmpty(doc), t("body.required"))
      .default(defaultBody),
  });
};

type ReplySchema = ReturnType<typeof useReplySchema>;

const ReplyComposer = (props: ReplyComposerProps) => {
  const { label, onCancel, onDone } = props;
  const t = useTranslations("@vitnode/forum.replies");
  const rejectReply = useForumRejection(REPLY_FORM_FIELDS);
  const formSchema = useReplySchema(
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

  const onSubmit: AutoFormOnSubmit<ReplySchema> = async ({ body }, form) => {
    if (props.mode === "edit") {
      const res = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "patch",
        module: "content/replies",
        path: "/{id}",
        args: {
          params: { id: props.replyId },
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

      await rejectReply(res, form);

      return;
    }

    const res = await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "post",
      module: "content/replies",
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

    await rejectReply(res, form);
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

export default ReplyComposer;
