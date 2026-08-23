import {
  CheckIcon,
  CircleCheckIcon,
  FileClockIcon,
  FileIcon,
  MinusIcon,
} from "lucide-react";

import type { ContentColumnSpec } from "@/content/admin/spec";
import type { ContentFileFieldValue } from "@/content/files";
import type { ContentLabels } from "@/content/server/service";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";

export interface ContentRowData extends Record<string, unknown> {
  /**
   * The resolved descriptor of each file field, keyed by field name.
   *
   * Carried beside the row by the generated list response, which is why a file
   * cell can show a thumbnail and a name rather than the `core_files.id` the
   * column actually holds. Absent for a content type with no file fields.
   *
   * A `multiple: true` field's entry is a list - and never reaches a cell: a
   * gallery is not one column, so `admin.list.columns` refuses it and the list
   * response loads no junction table. The union is here because one `files` bag
   * carries every file field of the row, whatever its arity.
   */
  files?: Record<string, ContentFileFieldValue>;
  id: number;
  labels: ContentLabels;
  /**
   * The record's translation in the reader's own language, when it has one.
   *
   * The list resolves exactly one - the language the person is already using
   * VitNode in - so a localized cell is an ordinary cell with one lookup in
   * front of it, and there is nothing above the table to choose.
   */
  translation?: null | { values?: Record<string, unknown> };
}

/**
 * What a cell reads: the row itself, or its translation for a localized field.
 *
 * `undefined` when the record has no translation in this language, which the
 * cell renders as the missing state rather than as a blank - a record nobody has
 * translated yet is exactly the row worth spotting in a list.
 */
export const contentCellValue = (
  row: ContentRowData,
  spec: ContentColumnSpec,
): unknown =>
  spec.localized === true
    ? row.translation?.values?.[spec.name]
    : row[spec.name];

const Empty = ({ label }: { label: string }) => (
  <span className="text-muted-foreground">{label}</span>
);

/** Only the shapes a column can actually hold - never "[object Object]". */
const asText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "boolean") return String(value);

  return "";
};

/**
 * Renders one list cell for a field kind.
 *
 * Deliberately plain: a plugin that wants more supplies `columns.<name>.cell`
 * in `buildPlugin`, and that override is used instead of this.
 */
export const ContentCell = ({
  emptyLabel,
  missingLabel,
  row,
  spec,
  statusLabels,
}: {
  emptyLabel: string;
  /** Shown for a localized cell of a record with no translation here. */
  missingLabel?: string;
  row: ContentRowData;
  spec: ContentColumnSpec;
  /** Translated `draft`/`published`, for the generated publication column. */
  statusLabels: { draft: string; published: string };
}) => {
  const value = contentCellValue(row, spec);

  // Before the generic emptiness check: what the column holds is an identifier,
  // and a raw `42` in a list is worse than useless - it is the one thing an
  // editor cannot recognise. An image gets its own thumbnail; everything else
  // gets an icon and its file name.
  if (spec.kind === "file") {
    const entry = row.files?.[spec.name];
    // A list means a gallery, which `resolveAdmin` refuses as a column - so this
    // is unreachable rather than merely unusual, and falling through to "empty"
    // is the right answer if it ever is not.
    const file = entry === undefined || Array.isArray(entry) ? null : entry;
    if (!file) return <Empty label={emptyLabel} />;

    const image = (file.mimeType ?? "").startsWith("image/");

    return (
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md"
        >
          {image ? (
            // Decorative: the file name is right beside it as real text, so an
            // alt would repeat it to a screen reader for no gain.
            <img
              alt=""
              className="size-full object-cover"
              loading="lazy"
              src={file.url}
            />
          ) : (
            <FileIcon className="size-4" />
          )}
        </span>
        <span className="truncate">{file.name}</span>
      </span>
    );
  }

  if (spec.kind === "relation" || spec.kind === "user") {
    const label = row.labels[spec.name];

    return label === null || label === undefined ? (
      <Empty label={emptyLabel} />
    ) : (
      <span className="truncate">{label}</span>
    );
  }

  if (value === null || value === undefined || value === "") {
    // "Nobody has written this in your language yet" and "this field is empty"
    // are different facts, and only the first is worth acting on.
    const missing =
      spec.localized === true && missingLabel !== undefined && !row.translation;

    return <Empty label={missing ? missingLabel : emptyLabel} />;
  }

  switch (spec.kind) {
    case "boolean":
      return value === true ? (
        <CheckIcon aria-hidden className="size-4" />
      ) : (
        <MinusIcon aria-hidden className="text-muted-foreground size-4" />
      );

    case "dateTime":
      return <DateFormat date={value as Date | string} />;

    case "enum": {
      const key = asText(value);

      return <Badge variant="secondary">{spec.options?.[key] ?? key}</Badge>;
    }

    case "number":
      return <span className="tabular-nums">{asText(value)}</span>;

    case "publication": {
      const published = value === "published";

      return (
        <Badge variant={published ? "default" : "secondary"}>
          {published ? (
            <CircleCheckIcon aria-hidden />
          ) : (
            <FileClockIcon aria-hidden />
          )}
          {published ? statusLabels.published : statusLabels.draft}
        </Badge>
      );
    }

    case "system":
      return spec.name === "id" ? (
        <span className="tabular-nums">{asText(value)}</span>
      ) : (
        <DateFormat date={value as Date | string} />
      );

    default:
      return (
        <span className="line-clamp-2 max-w-sm whitespace-normal">
          {asText(value)}
        </span>
      );
  }
};
