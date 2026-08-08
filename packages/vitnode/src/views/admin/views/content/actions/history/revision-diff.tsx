// No "use client": reached only from `history-action`, which is a client entry.
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

/** How many lines of a `textarea` diff are shown before it collapses. */
const TEXTAREA_PREVIEW_LINES = 8;

const Empty = ({ label }: { label: string }) => (
  <span aria-label={label} className="text-muted-foreground">
    —
  </span>
);

/**
 * One value, rendered the way its field kind reads best.
 *
 * Raw JSON is deliberately not the default anywhere: an editor comparing two
 * versions of an article is looking for a sentence that changed, and
 * `{"title":"..."}` makes them find it themselves.
 */
const Value = ({
  emptyLabel,
  kind,
  labels,
  options,
  value,
}: {
  emptyLabel: string;
  kind: string;
  /** Resolved display names for relation and user identifiers. */
  labels: Record<string, string>;
  options?: Record<string, string>;
  value: ContentSnapshotValue | undefined;
}) => {
  // Narrowed once, so the scalar branches below can use `String(...)` without
  // every one of them having to prove the value is not an object.
  if (value === null || value === undefined || value === "") {
    return <Empty label={emptyLabel} />;
  }

  // The three Stage 6 shapes reach here as objects and arrays rather than
  // scalars, and `String(...)` on any of them is `[object Object]`. Each gets a
  // summary a person can read: a group as its leaves, a to-many relation as its
  // targets, a repeatable as how many entries it holds.
  if (Array.isArray(value)) {
    if (value.length === 0) return <Empty label={emptyLabel} />;

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
    const leaves = Object.entries(value as Record<string, unknown>).filter(
      ([, leaf]) => leaf !== null && leaf !== "",
    );

    if (leaves.length === 0) return <Empty label={emptyLabel} />;

    return (
      <span className="wrap-break-word">
        {leaves
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

    // A snapshot stores the foreign key, never a label - the label belongs to
    // another content type and may not even be public. It is resolved for
    // display only, and falls back to the identifier.
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

/**
 * Field-level differences between two snapshots.
 *
 * Walks the content type's *current* fields, so a field dropped since the
 * snapshot was taken is absent rather than shown as "changed to nothing" -
 * which matches what a restore would actually do with it.
 */
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
            // The form spec carries picker options as a list; the renderer wants
            // a lookup from the stored value to its label.
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
    <dl className="flex flex-col gap-3">
      {entries.map(entry => {
        const field = byName.get(entry.name);
        const kind = field?.kind ?? "text";

        return (
          <div className="flex flex-col gap-1" key={entry.name}>
            <dt className="text-sm font-medium">
              {field?.label ?? entry.name}
            </dt>
            <dd className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="text-muted-foreground line-through">
                <Value
                  emptyLabel={emptyLabel}
                  kind={kind}
                  labels={labels}
                  options={field?.options}
                  value={entry.before}
                />
              </span>
              <span aria-hidden>→</span>
              <Value
                emptyLabel={emptyLabel}
                kind={kind}
                labels={labels}
                options={field?.options}
                value={entry.after}
              />
            </dd>
          </div>
        );
      })}
    </dl>
  );
};
