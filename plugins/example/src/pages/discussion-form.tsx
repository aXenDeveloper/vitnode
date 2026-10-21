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

/** The fields the forms render, so server issues on them show in place. */
export const DISCUSSION_FIELDS = ["title", "body", "board"] as const;

export interface DiscussionFormValues {
  body: RichTextDocument;
  title: string;
}

const createDiscussionFormSchema = (
  t: (key: "body.required" | "title.max" | "title.min") => string,
  defaults: DiscussionFormValues,
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

export type DiscussionFormSchema = ReturnType<
  typeof createDiscussionFormSchema
>;

export interface DiscussionBoardChoice {
  options: { label: string; value: string }[];
  selected?: string;
}

const createDiscussionCreateFormSchema = (
  t: (
    key: "board.required" | "body.required" | "title.max" | "title.min",
  ) => string,
  ids: [string, ...string[]],
  selected: string | undefined,
) => {
  const board = z.enum(ids, { error: t("board.required") });

  return createDiscussionFormSchema(t, {
    body: emptyRichTextDocument(),
    title: "",
  }).extend({
    board:
      selected !== undefined && ids.includes(selected)
        ? board.default(selected)
        : board,
  });
};

export type DiscussionCreateFormSchema = ReturnType<
  typeof createDiscussionCreateFormSchema
>;

const useDiscussionFields = () => {
  const t = useTranslations("@vitnode/example.discussions.form");

  return [
    {
      id: "title",
      component: (props: ItemAutoFormComponentProps) => (
        <AutoFormInput {...props} label={t("title.label")} />
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

export const DiscussionForm = ({
  defaultValues = { body: emptyRichTextDocument(), title: "" },
  isLeaving = false,
  onSubmit,
  submitLabel,
}: {
  defaultValues?: DiscussionFormValues;
  isLeaving?: boolean;
  onSubmit: AutoFormOnSubmit<DiscussionFormSchema>;
  submitLabel: string;
}) => {
  const t = useTranslations("@vitnode/example.discussions.form");
  const fields = useDiscussionFields();

  return (
    <AutoForm
      aria-busy={isLeaving}
      fields={fields}
      formSchema={createDiscussionFormSchema(t, defaultValues)}
      onSubmit={onSubmit}
      submitButtonProps={{
        children: submitLabel,
        className: "self-start",
        disabled: isLeaving,
      }}
    />
  );
};

export const DiscussionCreateForm = ({
  boards,
  isLeaving = false,
  onSubmit,
  submitLabel,
}: {
  boards: DiscussionBoardChoice;
  isLeaving?: boolean;
  onSubmit: AutoFormOnSubmit<DiscussionCreateFormSchema>;
  submitLabel: string;
}) => {
  const t = useTranslations("@vitnode/example.discussions.form");
  const fields = useDiscussionFields();
  const [first, ...rest] = boards.options.map(option => option.value);
  if (first === undefined) return null;

  return (
    <AutoForm
      aria-busy={isLeaving}
      fields={[
        {
          id: "board",
          component: props => (
            <AutoFormSelect
              {...props}
              description={t("board.desc")}
              label={t("board.label")}
              labels={boards.options}
              placeholder={t("board.placeholder")}
            />
          ),
        },
        ...fields,
      ]}
      formSchema={createDiscussionCreateFormSchema(
        t,
        [first, ...rest],
        boards.selected,
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
