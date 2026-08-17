// No "use client" here on purpose, for the same reason `content-form` has
// none: this is only reached from a client entry, and declaring it again would
// make it a nested one that `next/dynamic` cannot resolve from a package.
import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

import type { ContentFormSpec } from "@/content/admin/spec";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface ContentConflictState {
  currentVersion: number;
  /** The record as it is now, once the editor asked for it. */
  latest?: Record<string, unknown>;
}

const asText = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (value instanceof Date) return value.toISOString();

  // A row arrives as JSON, so a value is a primitive or it is something the
  // comparison has no opinion about - stringifying an object would compare
  // "[object Object]" against itself and report every row as unchanged.
  switch (typeof value) {
    case "bigint":
    case "boolean":
    case "number":
    case "string":
      return String(value);
    default:
      return JSON.stringify(value) ?? "—";
  }
};

/**
 * What another session changed while this dialog was open.
 *
 * Compared against the values the dialog *opened* with, not against what the
 * editor has typed since - the question being answered is "what did I not see",
 * and mixing in unsaved edits would answer a different one.
 */
const RemoteChanges = ({
  latest,
  opened,
  spec,
}: {
  latest: Record<string, unknown>;
  opened: Record<string, unknown>;
  spec: ContentFormSpec;
}) => {
  const changed = spec.fields.filter(
    field => asText(latest[field.name]) !== asText(opened[field.name]),
  );

  if (changed.length === 0) return null;

  return (
    <ul className="mt-2 flex flex-col gap-1">
      {changed.map(field => (
        <li className="flex flex-wrap items-baseline gap-2" key={field.name}>
          <span className="font-medium">{field.label}</span>
          <span className="text-muted-foreground line-through">
            {asText(opened[field.name])}
          </span>
          <span aria-hidden>→</span>
          <span>{asText(latest[field.name])}</span>
        </li>
      ))}
    </ul>
  );
};

/**
 * The lost-update banner.
 *
 * Three rules, and the reason this is a banner rather than a toast:
 *
 * 1. **Nothing the editor typed is discarded.** The form stays mounted; only
 *    this notice appears above it.
 * 2. **Nothing is overwritten automatically.** Reloading shows what changed and
 *    arms the submit button with the *new* version - saving again is then a
 *    deliberate second click, not a silent clobber.
 * 3. **No field merging.** Deciding which side of a conflicting paragraph wins
 *    is the editor's call, and guessing it is worse than asking.
 */
export const ConflictNotice = ({
  conflict,
  onReload,
  opened,
  spec,
}: {
  conflict: ContentConflictState;
  onReload: () => Promise<void>;
  opened: Record<string, unknown>;
  spec: ContentFormSpec;
}) => {
  const t = useTranslations("core.content.conflict");
  const [loading, setLoading] = React.useState(false);

  return (
    <Alert variant="warning">
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription>
        {conflict.latest ? (
          <>
            <p>{t("reloaded", { version: conflict.currentVersion })}</p>
            <RemoteChanges
              latest={conflict.latest}
              opened={opened}
              spec={spec}
            />
          </>
        ) : (
          <>
            <p>{t("desc", { version: conflict.currentVersion })}</p>
            <Button
              className="mt-2"
              disabled={loading}
              isLoading={loading}
              onClick={() => {
                setLoading(true);
                void onReload().finally(() => {
                  setLoading(false);
                });
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("reload")}
            </Button>
          </>
        )}
      </AlertDescription>
    </Alert>
  );
};
