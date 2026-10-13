import type { AutoFormOnSubmit } from "@vitnode/core/components/form/auto-form";
import type { ContentPublicWriteRejection } from "@vitnode/core/content";

import {
  AutoForm,
  setFormFieldError,
} from "@vitnode/core/components/form/auto-form";
import { AutoFormEditor } from "@vitnode/core/components/form/fields/editor";
import { AutoFormInput } from "@vitnode/core/components/form/fields/input";
import {
  emptyRichTextDocument,
  isRichTextEmpty,
  parseContentPublicWriteRejection,
  type RichTextDocument,
  zodRichTextDocument,
} from "@vitnode/core/content";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

const DISCUSSION_FIELDS = ["title", "body"] as const;

type DiscussionField = (typeof DISCUSSION_FIELDS)[number];

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

export type DiscussionFormApi = Parameters<
  AutoFormOnSubmit<DiscussionFormSchema>
>[1];

const isDiscussionField = (field: null | string): field is DiscussionField =>
  DISCUSSION_FIELDS.some(name => name === field);

const ISSUE_MESSAGE_KEYS = {
  not_writable: "issues.not_writable",
  unavailable: "issues.unavailable",
} as const;

const isKnownIssueCode = (
  code: string,
): code is keyof typeof ISSUE_MESSAGE_KEYS => code in ISSUE_MESSAGE_KEYS;

const REJECTION_MESSAGE_KEYS = {
  CONTENT_FORBIDDEN: "forbidden",
  CONTENT_INVALID_INPUT: "invalid",
  CONTENT_NOT_FOUND: "not_found",
  CONTENT_UNAUTHENTICATED: "unauthenticated",
} as const satisfies Record<ContentPublicWriteRejection["code"], string>;

export const useDiscussionRejection = () => {
  const t = useTranslations("@vitnode/example.discussions.errors");

  return async (response: Response, form: DiscussionFormApi) => {
    const rejection = parseContentPublicWriteRejection(
      await response.json().catch(() => null),
    );

    const messageOf = (code: string) =>
      t(isKnownIssueCode(code) ? ISSUE_MESSAGE_KEYS[code] : "invalid");

    const unmatched = (rejection?.issues ?? []).filter(issue => {
      if (!isDiscussionField(issue.field)) return true;
      setFormFieldError(form, issue.field, messageOf(issue.code));

      return false;
    });

    if (rejection?.code === "CONTENT_INVALID_INPUT" && unmatched.length === 0) {
      return;
    }

    toast.error(t("title"), {
      description: rejection
        ? rejection.code === "CONTENT_INVALID_INPUT"
          ? messageOf(unmatched[0]?.code ?? "")
          : t(REJECTION_MESSAGE_KEYS[rejection.code])
        : t("unknown"),
    });
  };
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
  const formSchema = createDiscussionFormSchema(t, defaultValues);

  return (
    <AutoForm
      aria-busy={isLeaving}
      fields={[
        {
          id: "title",
          component: props => (
            <AutoFormInput {...props} label={t("title.label")} />
          ),
        },
        {
          id: "body",
          component: props => (
            <AutoFormEditor
              {...props}
              description={t("body.desc")}
              format="json"
              label={t("body.label")}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{
        children: submitLabel,
        className: "self-start",
        disabled: isLeaving,
      }}
    />
  );
};
