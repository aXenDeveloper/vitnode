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
export const LETTER_FIELDS = ["title", "body", "desk"] as const;

export interface LetterFormValues {
  body: RichTextDocument;
  title: string;
}

const createLetterFormSchema = (
  t: (key: "body.required" | "title.max" | "title.min") => string,
  defaults: LetterFormValues,
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

export type LetterFormSchema = ReturnType<typeof createLetterFormSchema>;

export interface LetterDeskChoice {
  options: { label: string; value: string }[];
  selected?: string;
}

const createLetterCreateFormSchema = (
  t: (
    key: "body.required" | "desk.required" | "title.max" | "title.min",
  ) => string,
  ids: [string, ...string[]],
  selected: string | undefined,
) => {
  const desk = z.enum(ids, { error: t("desk.required") });

  return createLetterFormSchema(t, {
    body: emptyRichTextDocument(),
    title: "",
  }).extend({
    desk:
      selected !== undefined && ids.includes(selected)
        ? desk.default(selected)
        : desk,
  });
};

export type LetterCreateFormSchema = ReturnType<
  typeof createLetterCreateFormSchema
>;

const useLetterFields = () => {
  const t = useTranslations("newsroom.letters.form");

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

export const LetterForm = ({
  defaultValues = { body: emptyRichTextDocument(), title: "" },
  isLeaving = false,
  onSubmit,
  submitLabel,
}: {
  defaultValues?: LetterFormValues;
  isLeaving?: boolean;
  onSubmit: AutoFormOnSubmit<LetterFormSchema>;
  submitLabel: string;
}) => {
  const t = useTranslations("newsroom.letters.form");
  const fields = useLetterFields();

  return (
    <AutoForm
      aria-busy={isLeaving}
      fields={fields}
      formSchema={createLetterFormSchema(t, defaultValues)}
      onSubmit={onSubmit}
      submitButtonProps={{
        children: submitLabel,
        className: "self-start",
        disabled: isLeaving,
      }}
    />
  );
};

export const LetterCreateForm = ({
  desks,
  isLeaving = false,
  onSubmit,
  submitLabel,
}: {
  desks: LetterDeskChoice;
  isLeaving?: boolean;
  onSubmit: AutoFormOnSubmit<LetterCreateFormSchema>;
  submitLabel: string;
}) => {
  const t = useTranslations("newsroom.letters.form");
  const fields = useLetterFields();
  const [first, ...rest] = desks.options.map(option => option.value);
  if (first === undefined) return null;

  return (
    <AutoForm
      aria-busy={isLeaving}
      fields={[
        {
          id: "desk",
          component: props => (
            <AutoFormSelect
              {...props}
              description={t("desk.desc")}
              label={t("desk.label")}
              labels={desks.options}
              placeholder={t("desk.placeholder")}
            />
          ),
        },
        ...fields,
      ]}
      formSchema={createLetterCreateFormSchema(
        t,
        [first, ...rest],
        desks.selected,
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
