import type {
  AutoFormOnSubmit,
  ItemAutoFormComponentProps,
} from "@vitnode/core/components/form/auto-form";

import { AutoForm } from "@vitnode/core/components/form/auto-form";
import { AutoFormEditor } from "@vitnode/core/components/form/fields/editor";
import { AutoFormInput } from "@vitnode/core/components/form/fields/input";
import { AutoFormSelect } from "@vitnode/core/components/form/fields/select";
import {
  emptyRichTextDocument,
  isRichTextEmpty,
  type RichTextDocument,
  zodRichTextDocument,
} from "@vitnode/core/content";
import { useTranslations } from "use-intl";
import { z } from "zod";

export const TOPIC_FORM_FIELDS = ["title", "body", "forum"] as const;

export interface TopicFormValues {
  body: RichTextDocument;
  title: string;
}

type TopicFormKey = "body.required" | "title.max" | "title.min";

const createTopicFormSchema = (
  t: (key: TopicFormKey) => string,
  defaults: TopicFormValues,
) =>
  z.object({
    title: z
      .string()
      .trim()
      .min(3, t("title.min"))
      .max(200, t("title.max"))
      .default(defaults.title),
    body: zodRichTextDocument
      .refine(doc => !isRichTextEmpty(doc), t("body.required"))
      .default(defaults.body),
  });

export type TopicFormSchema = ReturnType<typeof createTopicFormSchema>;

export interface ForumChoice {
  options: { label: string; value: string }[];
  selected?: string;
}

const createTopicCreateFormSchema = (
  t: (key: "forum.required" | TopicFormKey) => string,
  ids: [string, ...string[]],
  selected: string | undefined,
) => {
  const forum = z.enum(ids, { error: t("forum.required") });

  return createTopicFormSchema(t, {
    body: emptyRichTextDocument(),
    title: "",
  }).extend({
    forum:
      selected !== undefined && ids.includes(selected)
        ? forum.default(selected)
        : forum,
  });
};

export type TopicCreateFormSchema = ReturnType<
  typeof createTopicCreateFormSchema
>;

const useTopicFields = () => {
  const t = useTranslations("@vitnode/forum.topics.form");

  return [
    {
      id: "title",
      component: (props: ItemAutoFormComponentProps) => (
        <AutoFormInput
          {...props}
          description={t("title.desc")}
          label={t("title.label")}
        />
      ),
    },
    {
      id: "body",
      component: (props: ItemAutoFormComponentProps) => (
        <AutoFormEditor
          {...props}
          description={t("body.desc")}
          format="json"
          label={t("body.label")}
        />
      ),
    },
  ];
};

export const TopicForm = ({
  defaultValues = { body: emptyRichTextDocument(), title: "" },
  isLeaving = false,
  onSubmit,
  submitLabel,
}: {
  defaultValues?: TopicFormValues;
  isLeaving?: boolean;
  onSubmit: AutoFormOnSubmit<TopicFormSchema>;
  submitLabel: string;
}) => {
  const t = useTranslations("@vitnode/forum.topics.form");
  const fields = useTopicFields();

  return (
    <AutoForm
      aria-busy={isLeaving}
      fields={fields}
      formSchema={createTopicFormSchema(t, defaultValues)}
      onSubmit={onSubmit}
      submitButtonProps={{
        children: submitLabel,
        className: "self-start",
        disabled: isLeaving,
      }}
    />
  );
};

export const TopicCreateForm = ({
  forums,
  isLeaving = false,
  onSubmit,
  submitLabel,
}: {
  forums: ForumChoice;
  isLeaving?: boolean;
  onSubmit: AutoFormOnSubmit<TopicCreateFormSchema>;
  submitLabel: string;
}) => {
  const t = useTranslations("@vitnode/forum.topics.form");
  const fields = useTopicFields();
  const [first, ...rest] = forums.options.map(option => option.value);
  if (first === undefined) return null;

  return (
    <AutoForm
      aria-busy={isLeaving}
      fields={[
        {
          id: "forum",
          component: props => (
            <AutoFormSelect
              {...props}
              description={t("forum.desc")}
              label={t("forum.label")}
              labels={forums.options}
              placeholder={t("forum.placeholder")}
            />
          ),
        },
        ...fields,
      ]}
      formSchema={createTopicCreateFormSchema(
        t,
        [first, ...rest],
        forums.selected,
      )}
      onSubmit={onSubmit}
      submitButtonProps={{
        children: submitLabel,
        className: "self-start",
        disabled: isLeaving,
      }}
    />
  );
};
