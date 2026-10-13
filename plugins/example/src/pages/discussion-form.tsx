import type {
  AutoFormOnSubmit,
  ItemAutoFormComponentProps,
} from "@vitnode/core/components/form/auto-form";
import type { ContentPublicWriteRejection } from "@vitnode/core/content";

import {
  AutoForm,
  setFormFieldError,
} from "@vitnode/core/components/form/auto-form";
import { AutoFormEditor } from "@vitnode/core/components/form/fields/editor";
import { AutoFormInput } from "@vitnode/core/components/form/fields/input";
import { AutoFormSelect } from "@vitnode/core/components/form/fields/select";
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

const DISCUSSION_FIELDS = ["title", "body", "board"] as const;

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

type DiscussionFormApi = Parameters<typeof setFormFieldError>[0];

const isDiscussionField = (field: null | string): field is DiscussionField =>
  DISCUSSION_FIELDS.some(name => name === field);

const ISSUE_MESSAGE_KEYS = {
  not_writable: "issues.not_writable",
  unavailable: "issues.unavailable",
} as const;

const BOARD_ISSUE_MESSAGE_KEY = "issues.board_unavailable";

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

    const messageOf = (code: string, field?: DiscussionField) =>
      t(
        field === "board" && code === "unavailable"
          ? BOARD_ISSUE_MESSAGE_KEY
          : isKnownIssueCode(code)
            ? ISSUE_MESSAGE_KEYS[code]
            : "invalid",
      );

    const unmatched = (rejection?.issues ?? []).filter(issue => {
      if (!isDiscussionField(issue.field)) return true;
      setFormFieldError(form, issue.field, messageOf(issue.code, issue.field));

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
