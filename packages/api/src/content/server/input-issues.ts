import type { ZodError } from "zod";

import type { ContentInputIssue } from "../conflicts";

import { CONTENT_INPUT_ISSUE_CODES } from "../const";

type ZodIssue = ZodError["issues"][number];

const fieldOf = (path: ZodIssue["path"]): null | string => {
  const segments: string[] = [];

  for (const segment of path) {
    if (typeof segment !== "string") break;
    segments.push(segment);
  }

  return segments.length === 0 ? null : segments.join(".");
};

const isMissingValue = (issue: ZodIssue): boolean =>
  issue.code === "invalid_type" &&
  "input" in issue &&
  issue.input === undefined;

export const contentInputIssues = (
  error: ZodError,
  locale: null | string,
): ContentInputIssue[] => {
  const issues = new Map<string, ContentInputIssue>();

  for (const issue of error.issues) {
    const entry: ContentInputIssue = {
      code: isMissingValue(issue)
        ? CONTENT_INPUT_ISSUE_CODES.required
        : issue.code,
      field: fieldOf(issue.path),
      locale,
    };

    issues.set(`${entry.field ?? ""}:${entry.code}`, entry);
  }

  return [...issues.values()];
};
