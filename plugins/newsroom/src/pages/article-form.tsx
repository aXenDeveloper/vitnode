import {
  AutoForm,
  type AutoFormOnSubmit,
} from "@vitnode/core/components/form/auto-form";
import { AutoFormEditor } from "@vitnode/core/components/form/fields/editor";
import { AutoFormInput } from "@vitnode/core/components/form/fields/input";
import {
  isRichTextEmpty,
  type RichTextDocument,
  zodRichTextDocument,
} from "@vitnode/core/content";
import { useTranslations } from "use-intl";
import { z } from "zod";

/** The fields the form renders, so server errors on them show in place. */
export const ARTICLE_FORM_FIELDS = ["title", "body"] as const;

export interface ArticleFormValues {
  body: RichTextDocument;
  title: string;
}

const createArticleFormSchema = (defaults: ArticleFormValues) =>
  z.object({
    title: z.string().trim().min(3).max(200).default(defaults.title),
    body: zodRichTextDocument
      .refine(doc => !isRichTextEmpty(doc))
      .default(defaults.body),
  });

export type ArticleFormSchema = ReturnType<typeof createArticleFormSchema>;

export const ArticleForm = ({
  defaultValues,
  onSubmit,
  submitLabel,
}: {
  defaultValues: ArticleFormValues;
  onSubmit: AutoFormOnSubmit<ArticleFormSchema>;
  submitLabel: string;
}) => {
  const t = useTranslations("newsroom.articles.form");

  return (
    <AutoForm
      fields={[
        {
          id: "title",
          component: props => <AutoFormInput {...props} label={t("title")} />,
        },
        {
          id: "body",
          component: props => (
            <AutoFormEditor {...props} format="json" label={t("body")} />
          ),
        },
      ]}
      formSchema={createArticleFormSchema(defaultValues)}
      onSubmit={onSubmit}
      submitButtonProps={{ children: submitLabel, className: "self-start" }}
    />
  );
};
