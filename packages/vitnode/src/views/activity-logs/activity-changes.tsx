import { LockIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { ActivityDetail } from "./activity-query";

/** A recorded JSON value as text: strings as they are, anything else as JSON. */
export const formatActivityValue = (value: unknown): string =>
  typeof value === "string" ? value : JSON.stringify(value);

/** The field names an entry's `metadata.changedFields` lists. */
export const activityChangedFields = (
  metadata: Record<string, unknown>,
): string[] =>
  Array.isArray(metadata.changedFields)
    ? metadata.changedFields.filter(
        (name): name is string => typeof name === "string",
      )
    : [];

export const isEmptyActivityValue = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

export const ActivityChangeValue = ({ value }: { value: unknown }) => {
  const t = useTranslations("core.activity_logs.detail");

  if (isEmptyActivityValue(value)) {
    return (
      <span className="text-muted-foreground italic">{t("empty_value")}</span>
    );
  }

  return (
    <span className="font-mono text-sm leading-relaxed break-words whitespace-pre-wrap">
      {formatActivityValue(value)}
    </span>
  );
};

export interface ActivityChangeRow {
  after?: unknown;
  before?: unknown;
  label: string;
  name: string;
  redacted?: boolean;
}

/** Recorded changes as rows of field, before and after, rather than raw JSON. */
export const activityChangeRows = (
  changes: ActivityDetail["changes"],
  label: (name: string) => string,
): ActivityChangeRow[] =>
  Object.entries(changes ?? {}).map(([name, change]) => ({
    after: change.to,
    before: change.from,
    label: label(name),
    name,
    redacted: change.redacted === true,
  }));

/**
 * Changes an operation recorded as metadata pairs - `pointsBefore` and
 * `pointsAfter` become one `points` row - and the keys they used, so the
 * remaining metadata can be listed apart from them.
 */
export const activityMetadataChangeRows = (
  metadata: Record<string, unknown>,
  label: (name: string) => string,
): { keys: Set<string>; rows: ActivityChangeRow[] } => {
  const keys = new Set<string>();
  const rows: ActivityChangeRow[] = [];
  for (const key of Object.keys(metadata)) {
    const name = /^(.+)Before$/.exec(key)?.[1];
    const afterKey = `${name}After`;
    if (!name || !(afterKey in metadata)) continue;
    keys.add(key);
    keys.add(afterKey);
    rows.push({
      after: metadata[afterKey],
      before: metadata[key],
      label: label(name),
      name,
    });
  }

  return { keys, rows };
};

/**
 * Before/after pairs, one field per row. Stacked on a phone, side by side
 * from `sm` up. A redacted field says that it changed and nothing more.
 */
export const ActivityChanges = ({ rows }: { rows: ActivityChangeRow[] }) => {
  const t = useTranslations("core.activity_logs.detail");

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("no_changes")}
      </p>
    );
  }

  return (
    <dl className="flex flex-col gap-3">
      {rows.map(row => (
        <div
          className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3"
          key={row.name}
        >
          <dt className="text-sm font-medium">{row.label}</dt>
          {row.redacted ? (
            <dd className="text-muted-foreground flex items-center gap-2 text-sm">
              <LockIcon aria-hidden className="size-4" />
              {t("redacted")}
            </dd>
          ) : (
            <dd className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-muted-foreground text-xs font-medium uppercase">
                  {t("before")}
                </span>
                <ActivityChangeValue value={row.before} />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-muted-foreground text-xs font-medium uppercase">
                  {t("after")}
                </span>
                <ActivityChangeValue value={row.after} />
              </div>
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
};
