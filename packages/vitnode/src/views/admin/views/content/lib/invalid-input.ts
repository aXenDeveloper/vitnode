import type { ContentInvalidInput } from "@vitnode/api/content/conflicts";

import { humanizeFieldName } from "@vitnode/api/content/admin/labels";
import { CONTENT_INPUT_ISSUE_CODES } from "@vitnode/api/content/const";

import type {
  ContentFormFieldSpec,
  ContentFormSpec,
} from "@/content/admin/spec";

export interface ContentInvalidField {
  label: string;
  locale: null | string;
}

interface ContentInvalidFields {
  invalid: ContentInvalidField[];
  required: ContentInvalidField[];
}

const fieldLabel = (
  fields: readonly ContentFormFieldSpec[],
  path: string,
): string => {
  let scope = fields;
  let label = humanizeFieldName(path.split(".").at(-1) ?? path);

  for (const segment of path.split(".")) {
    const match = scope.find(field => field.name === segment);
    if (!match) break;

    label = match.label;
    scope = match.fields ?? [];
  }

  return label;
};

export const contentInvalidFields = (
  spec: Pick<ContentFormSpec, "fields">,
  invalid: ContentInvalidInput,
): ContentInvalidFields => {
  const grouped: ContentInvalidFields = { invalid: [], required: [] };

  for (const issue of invalid.issues) {
    if (issue.field === null) continue;

    const group =
      issue.code === CONTENT_INPUT_ISSUE_CODES.required
        ? grouped.required
        : grouped.invalid;
    const label = fieldLabel(spec.fields, issue.field);

    if (
      group.some(
        field => field.label === label && field.locale === issue.locale,
      )
    ) {
      continue;
    }

    group.push({ label, locale: issue.locale });
  }

  return grouped;
};
