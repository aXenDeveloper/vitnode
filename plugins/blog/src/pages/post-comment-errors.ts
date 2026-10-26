import type { ContentPublicWriteRejection } from "@vitnode/core/content";

import { setFormFieldError } from "@vitnode/core/components/form/auto-form";
import { parseContentPublicWriteRejection } from "@vitnode/core/content";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

type FormApi = Parameters<typeof setFormFieldError>[0];

const ISSUE_MESSAGE_KEYS = {
  edit_window_closed: "issues.edit_window_closed",
  not_writable: "issues.not_writable",
  unavailable: "issues.unavailable",
} as const;

const FIELD_ISSUE_MESSAGE_KEYS = {
  article: "issues.article_unavailable",
  parent: "issues.parent_unavailable",
} as const;

const REJECTION_MESSAGE_KEYS = {
  CONTENT_FORBIDDEN: "forbidden",
  CONTENT_INVALID_INPUT: "invalid",
  CONTENT_NOT_FOUND: "not_found",
  CONTENT_UNAUTHENTICATED: "unauthenticated",
} as const satisfies Record<ContentPublicWriteRejection["code"], string>;

const isKnownIssueCode = (
  code: string,
): code is keyof typeof ISSUE_MESSAGE_KEYS => code in ISSUE_MESSAGE_KEYS;

const isPlacementField = (
  field: null | string,
): field is keyof typeof FIELD_ISSUE_MESSAGE_KEYS =>
  field !== null && field in FIELD_ISSUE_MESSAGE_KEYS;

export const useCommentRejection = (formFields: readonly string[]) => {
  const t = useTranslations("@vitnode/blog.comments.errors");

  const messageOf = (code: string, field: null | string) => {
    if (isKnownIssueCode(code) && code !== "unavailable") {
      return t(ISSUE_MESSAGE_KEYS[code]);
    }
    if (isPlacementField(field)) return t(FIELD_ISSUE_MESSAGE_KEYS[field]);

    return t(isKnownIssueCode(code) ? ISSUE_MESSAGE_KEYS[code] : "invalid");
  };

  return async (response: Response, form?: FormApi) => {
    const rejection = parseContentPublicWriteRejection(
      await response.json().catch(() => null),
    );

    const unmatched = (rejection?.issues ?? []).filter(issue => {
      if (!form || issue.field === null || !formFields.includes(issue.field)) {
        return true;
      }
      setFormFieldError(form, issue.field, messageOf(issue.code, issue.field));

      return false;
    });

    if (rejection?.code === "CONTENT_INVALID_INPUT" && unmatched.length === 0) {
      return;
    }

    const [first] = unmatched;

    toast.error(t("title"), {
      description: rejection
        ? first &&
          (rejection.code === "CONTENT_INVALID_INPUT" ||
            isKnownIssueCode(first.code))
          ? messageOf(first.code, first.field)
          : t(REJECTION_MESSAGE_KEYS[rejection.code])
        : t("unknown"),
    });
  };
};
