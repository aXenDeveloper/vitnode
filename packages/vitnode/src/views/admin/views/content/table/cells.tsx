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
import { isContentPublished } from "@/content/publication";

export interface ContentRowData extends Record<string, unknown> {
  files?: Record<string, ContentFileFieldValue>;
  id: number;
  labels: ContentLabels;
  translation?: null | { values?: Record<string, unknown> };
}

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

export const ContentCell = ({
  emptyLabel,
  missingLabel,
  row,
  spec,
  statusLabels,
}: {
  emptyLabel: string;
  missingLabel?: string;
  row: ContentRowData;
  spec: ContentColumnSpec;
  statusLabels: { draft: string; published: string };
}) => {
  const value = contentCellValue(row, spec);

  if (spec.kind === "file") {
    const entry = row.files?.[spec.name];
    const file = entry === undefined || Array.isArray(entry) ? null : entry;
    if (!file) return <Empty label={emptyLabel} />;

    // A url as well as an image MIME type: a `core_files` row stores a `key`
    // and the url is built at read time from the configured storage adapter, so
    // an installation with no `storage.adapter` describes every file with
    // `url: ""`. `<img src="">` makes the browser re-request the document.
    const image = file.url !== "" && (file.mimeType ?? "").startsWith("image/");

    return (
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md"
        >
          {image ? (
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
      const published = isContentPublished(value);

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
