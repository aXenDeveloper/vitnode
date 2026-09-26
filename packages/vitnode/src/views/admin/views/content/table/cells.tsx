import {
  CheckIcon,
  CircleCheckIcon,
  FileClockIcon,
  FileIcon,
  ImageIcon,
  MinusIcon,
} from "lucide-react";

import type { ContentColumnSpec } from "@/content/admin/spec";
import type {
  ContentFileDescriptor,
  ContentFileFieldValue,
} from "@/content/files";
import type { ContentReferenceListItem } from "@/content/server/list-references";
import type { ContentLabels } from "@/content/server/service";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { UserFormat } from "@/components/user-format";
import { isContentPublished } from "@/content/publication";

export interface ContentRowData extends Record<string, unknown> {
  files?: Record<string, ContentFileFieldValue>;
  id: number;
  labels: ContentLabels;
  localizedValues?: Record<string, unknown>;
  references?: Record<string, ContentReferenceListItem[]>;
}

export const contentCellValue = (
  row: ContentRowData,
  spec: ContentColumnSpec,
): unknown =>
  spec.localized === true ? row.localizedValues?.[spec.name] : row[spec.name];

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

const singleFileOf = (
  row: ContentRowData,
  name: string,
): ContentFileDescriptor | null => {
  const entry = row.files?.[name];

  return entry === undefined || Array.isArray(entry) ? null : entry;
};

const ContentFileThumbnail = ({
  file,
}: {
  file: ContentFileDescriptor | null;
}) => {
  // A url as well as an image MIME type: a `core_files` row stores a `key`
  // and the url is built at read time from the configured storage adapter, so
  // an installation with no `storage.adapter` describes every file with
  // `url: ""`. `<img src="">` makes the browser re-request the document.
  const image =
    file !== null &&
    file.url !== "" &&
    (file.mimeType ?? "").startsWith("image/");

  return (
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
      ) : file ? (
        <FileIcon className="size-4" />
      ) : (
        <ImageIcon className="size-4" />
      )}
    </span>
  );
};

const ContentReferenceList = ({
  emptyLabel,
  items,
  kind,
}: {
  emptyLabel: string;
  items: readonly ContentReferenceListItem[];
  kind: "relation" | "user";
}) => {
  if (items.length === 0) return <Empty label={emptyLabel} />;

  if (kind === "user") {
    return (
      <ul className="flex max-w-xs flex-wrap items-center gap-x-1 gap-y-1">
        {items.map((item, index) => (
          <li className="flex min-w-0 items-center" key={item.value}>
            <UserFormat
              format
              user={{
                name: item.label,
                role: item.role ?? { color: null, prefix: null },
              }}
            />
            {index < items.length - 1 && (
              <span aria-hidden className="text-muted-foreground">
                ,
              </span>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="flex max-w-xs flex-wrap items-center gap-x-3 gap-y-1">
      {items.map(item => (
        <li className="flex min-w-0 items-center" key={item.value}>
          <Badge variant="secondary">
            {!!item.color && (
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
            )}
            {item.label}
          </Badge>
        </li>
      ))}
    </ul>
  );
};

interface ContentCellProps {
  emptyLabel: string;
  row: ContentRowData;
  spec: ContentColumnSpec;
  statusLabels: { draft: string; published: string };
}

const ContentCellValue = ({
  emptyLabel,
  row,
  spec,
  statusLabels,
}: ContentCellProps) => {
  const value = contentCellValue(row, spec);

  if (spec.kind === "file") {
    const file = singleFileOf(row, spec.name);
    if (!file) return <Empty label={emptyLabel} />;

    return (
      <span className="flex min-w-0 items-center gap-2">
        <ContentFileThumbnail file={file} />
        <span className="truncate">{file.name}</span>
      </span>
    );
  }

  if (
    spec.multiple === true &&
    (spec.kind === "relation" || spec.kind === "user")
  ) {
    return (
      <ContentReferenceList
        emptyLabel={emptyLabel}
        items={row.references?.[spec.name] ?? []}
        kind={spec.kind}
      />
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
    return <Empty label={emptyLabel} />;
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

export const ContentCell = (props: ContentCellProps) =>
  props.spec.thumbnail === undefined ? (
    <ContentCellValue {...props} />
  ) : (
    <span className="flex min-w-0 items-center gap-3">
      <ContentFileThumbnail
        file={singleFileOf(props.row, props.spec.thumbnail)}
      />
      <ContentCellValue {...props} />
    </span>
  );
