import type {
  ContentFieldDescriptor,
  ContentFieldMap,
  ContentReportsInput,
  ResolvedContentAdminConfig,
  ResolvedContentPublicApiConfig,
  ResolvedContentReportsConfig,
} from "./types";

import { ContentEngineError } from "./errors";

export const CONTENT_REPORT_SNAPSHOT_KINDS = new Set<
  ContentFieldDescriptor["kind"]
>([
  "boolean",
  "dateTime",
  "enum",
  "file",
  "number",
  "richText",
  "slug",
  "text",
  "textarea",
]);

const DEFAULT_SNAPSHOT_KINDS = new Set<ContentFieldDescriptor["kind"]>([
  "enum",
  "file",
  "richText",
  "text",
  "textarea",
]);

const TITLE_KINDS = new Set<ContentFieldDescriptor["kind"]>([
  "richText",
  "slug",
  "text",
  "textarea",
]);

const DISABLED: ResolvedContentReportsConfig<false> = {
  enabled: false,
  selfReport: false,
  snapshotFields: [],
  titleField: null,
};

const REPORT_OPTION_KEYS = new Set([
  "selfReport",
  "snapshotFields",
  "titleField",
]);

export const resolveReports = (
  id: string,
  reports: ContentReportsInput | undefined,
  {
    admin,
    fields,
    publicApi,
  }: {
    admin: ResolvedContentAdminConfig;
    fields: ContentFieldMap;
    publicApi: ResolvedContentPublicApiConfig;
  },
): ResolvedContentReportsConfig => {
  if (reports === undefined || reports === false) return DISABLED;

  if (reports !== true && (typeof reports !== "object" || reports === null)) {
    throw new ContentEngineError(
      "reports is `true` or an options object with `titleField`, `snapshotFields` and `selfReport`.",
      { contentTypeId: id },
    );
  }

  const options = reports === true ? {} : reports;
  const unknownKey = Object.keys(options).find(
    key => !REPORT_OPTION_KEYS.has(key),
  );
  if (unknownKey) {
    throw new ContentEngineError(
      `reports.${unknownKey} is not an option. Use \`titleField\`, \`snapshotFields\` and \`selfReport\`.`,
      { contentTypeId: id },
    );
  }

  if (!publicApi.enabled) {
    throw new ContentEngineError(
      "reports needs `publicApi`. Users report what they can read, and the public API is what decides that.",
      { contentTypeId: id },
    );
  }

  const publicFields = new Set<string>(publicApi.fields);

  let titleField: null | string;
  if (options.titleField !== undefined) {
    const descriptor = fields[options.titleField];
    if (!descriptor || !TITLE_KINDS.has(descriptor.kind)) {
      throw new ContentEngineError(
        `reports.titleField "${options.titleField}" must be a text, textarea, slug or rich text field of this content type.`,
        { contentTypeId: id },
      );
    }
    titleField = options.titleField;
  } else {
    titleField =
      admin.titleField !== null && publicFields.has(admin.titleField)
        ? admin.titleField
        : null;
  }

  let snapshotFields: string[];
  if (options.snapshotFields !== undefined) {
    if (!Array.isArray(options.snapshotFields)) {
      throw new ContentEngineError(
        "reports.snapshotFields is a list of field names.",
        { contentTypeId: id },
      );
    }
    for (const name of options.snapshotFields) {
      const descriptor = fields[name];
      if (!descriptor) {
        throw new ContentEngineError(
          `reports.snapshotFields references unknown field "${name}".`,
          { contentTypeId: id },
        );
      }
      if (!CONTENT_REPORT_SNAPSHOT_KINDS.has(descriptor.kind)) {
        throw new ContentEngineError(
          `reports.snapshotFields names the ${descriptor.kind} field "${name}". A snapshot keeps self-contained values only: text, textarea, rich text, slug, number, boolean, enum, date and file fields.`,
          { contentTypeId: id },
        );
      }
    }
    snapshotFields = [...new Set(options.snapshotFields)];
  } else {
    snapshotFields = Object.entries(fields)
      .filter(
        ([name, descriptor]) =>
          name !== titleField &&
          publicFields.has(name) &&
          DEFAULT_SNAPSHOT_KINDS.has(descriptor.kind),
      )
      .map(([name]) => name);
  }

  if (
    options.selfReport !== undefined &&
    typeof options.selfReport !== "boolean"
  ) {
    throw new ContentEngineError("reports.selfReport is `true` or `false`.", {
      contentTypeId: id,
    });
  }

  return {
    enabled: true,
    selfReport: options.selfReport ?? false,
    snapshotFields,
    titleField,
  };
};
