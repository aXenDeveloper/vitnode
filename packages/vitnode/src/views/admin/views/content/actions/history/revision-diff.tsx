// No "use client": reached only from `history-action`, which is a client entry.
import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

import type { ContentFormSpec } from "@/content/admin/spec";
import type {
  ContentRevisionSnapshot,
  ContentSnapshotValue,
} from "@/content/revisions";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { contentRevisionDiff } from "@/content/revisions";
import { cn } from "@/lib/utils";

const TEXTAREA_PREVIEW_LINES = 8;

const TOKEN_KINDS = new Set([
  "boolean",
  "dateTime",
  "number",
  "relation",
  "user",
]);

/**
 * Whether a value is "nothing".
 *
 * One predicate, used both by the renderer and by the layout around it: an
 * em-dash stands on its own, a real value is set in a box, and the two have to
 * agree or a row shows an empty container.
 */
const isBlank = (value: ContentSnapshotValue | undefined): boolean => {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(
      leaf => leaf === null || leaf === "",
    );
  }

  return false;
};

const Empty = ({ label }: { label: string }) => (
  <span aria-label={label} className="text-muted-foreground">
    —
  </span>
);

const Value = ({
  emptyLabel,
  kind,
  labels,
  options,
  value,
}: {
  emptyLabel: string;
  kind: string;
  labels: Record<string, string>;
  options?: Record<string, string>;
  value: ContentSnapshotValue | undefined;
}) => {
  if (isBlank(value)) return <Empty label={emptyLabel} />;

  if (Array.isArray(value)) {
    if (typeof value[0] === "number") {
      return (
        <span>
          {(value as number[])
            .map(id => labels[String(id)] ?? `#${id}`)
            .join(", ")}
        </span>
      );
    }

    return (
      <span className="tabular-nums">
        {emptyLabel === "" ? value.length : `× ${value.length}`}
      </span>
    );
  }

  if (typeof value === "object") {
    return (
      <span className="wrap-break-word">
        {Object.entries(value as Record<string, unknown>)
          .filter(([, leaf]) => leaf !== null && leaf !== "")
          .map(([leaf, leafValue]) => `${leaf}: ${String(leafValue)}`)
          .join(", ")}
      </span>
    );
  }

  switch (kind) {
    case "boolean":
      return <span>{value === true ? "✓" : "—"}</span>;

    case "dateTime":
      return <DateFormat date={String(value)} />;

    case "enum":
      return (
        <Badge variant="secondary">
          {options?.[String(value)] ?? String(value)}
        </Badge>
      );

    case "number":
      return <span className="tabular-nums">{String(value)}</span>;

    case "relation":
    case "user":
      return <span>{labels[String(value)] ?? `#${String(value)}`}</span>;

    case "textarea": {
      const text = String(value);
      const lines = text.split("\n");

      return lines.length > TEXTAREA_PREVIEW_LINES ? (
        <details>
          <summary className="cursor-pointer">
            {lines.slice(0, TEXTAREA_PREVIEW_LINES).join("\n")}
          </summary>
          <span className="whitespace-pre-wrap">{text}</span>
        </details>
      ) : (
        <span className="whitespace-pre-wrap">{text}</span>
      );
    }

    default:
      return <span className="wrap-break-word">{String(value)}</span>;
  }
};

const Side = ({
  before = false,
  kind,
  ...props
}: {
  before?: boolean;
  emptyLabel: string;
  kind: string;
  labels: Record<string, string>;
  options?: Record<string, string>;
  value: ContentSnapshotValue | undefined;
}) => {
  if (isBlank(props.value)) return <Empty label={props.emptyLabel} />;

  return (
    <span
      className={cn(
        "min-w-0 wrap-break-word",
        TOKEN_KINDS.has(kind) &&
          "bg-background rounded-md border px-1.5 py-0.5",
        before && "text-muted-foreground line-through",
      )}
    >
      <Value kind={kind} {...props} />
    </span>
  );
};

export const RevisionDiff = ({
  after,
  before,
  labels = {},
  spec,
}: {
  after: ContentRevisionSnapshot;
  before: ContentRevisionSnapshot | null;
  labels?: Record<string, string>;
  spec: ContentFormSpec;
}) => {
  const t = useTranslations("core.content");
  const byName = React.useMemo(
    () =>
      new Map(
        spec.fields.map(field => [
          field.name,
          {
            ...field,
            options: Object.fromEntries(
              (field.options ?? []).map(option => [option.value, option.label]),
            ),
          },
        ]),
      ),
    [spec],
  );

  const entries = React.useMemo(
    () =>
      contentRevisionDiff(
        spec.fields.map(field => field.name),
        before,
        after,
      ),
    [after, before, spec],
  );

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t("history.no_changes")}</p>
    );
  }

  const emptyLabel = t("table.empty_value");

  return (
    <dl className="grid gap-x-4 gap-y-2.5 text-sm sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
      {entries.map(entry => {
        const field = byName.get(entry.name);
        const kind = field?.kind ?? "text";
        const shared = {
          emptyLabel,
          kind,
          labels,
          options: field?.options,
        };

        return (
          <React.Fragment key={entry.name}>
            <dt className="truncate sm:pt-0.5">{field?.label ?? entry.name}</dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-2">
              <Side {...shared} before value={entry.before} />
              <ArrowRightIcon
                aria-hidden
                className="text-muted-foreground/50 size-3.5 shrink-0"
              />
              <span className="sr-only">{t("history.changed_to")}</span>
              <Side {...shared} value={entry.after} />
            </dd>
          </React.Fragment>
        );
      })}
    </dl>
  );
};
