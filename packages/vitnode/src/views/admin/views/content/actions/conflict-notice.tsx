// No "use client" here on purpose, for the same reason `content-form` has
// none: this is only reached from a client entry, and declaring it again would
// make it a nested one that `next/dynamic` cannot resolve from a package.
import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

import type { ContentFormSpec } from "@/content/admin/spec";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
 * What another session changed while this form was open.
 *
 * Compared against the values the form *opened* with, not against what the
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
    <ul className="mt-3 flex flex-col gap-1 text-sm">
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
 * The lost-update dialog.
 *
 * A **modal** rather than a banner above the form, and that is the point: a save
 * that did not happen is not something to notice later. A notice inline with the
 * fields competes with the fields, and on a page-mode form long enough to scroll
 * it can be off screen entirely - so the one outcome the editor must not get is
 * exactly the one they got: pressing Save, seeing nothing change, and pressing it
 * again.
 *
 * Three rules survive the change, and they are why this is a dialog rather than a
 * toast:
 *
 * 1. **Nothing the editor typed is discarded.** The form stays mounted behind
 *    the overlay; this is a portal, and closing it returns them to every value
 *    they had.
 * 2. **Nothing is overwritten automatically.** Reloading shows what changed and
 *    arms the next save with the *new* version - saving again is then a
 *    deliberate second click, not a silent clobber.
 * 3. **No field merging.** Deciding which side of a conflicting paragraph wins
 *    is the editor's call, and guessing it is worse than asking.
 */
export const ConflictNotice = ({
  conflict,
  name,
  onDismiss,
  onReload,
  opened,
  spec,
}: {
  conflict: ContentConflictState;
  /**
   * The content type's singular label - "Article", not "record".
   *
   * Required rather than optional, and that is deliberate: `desc` is an ICU
   * message with a `{name}` placeholder, and a missing argument is not a blank in
   * next-intl - it is a formatting error, and the reader gets the literal string
   * `core.content.conflict.desc` where the sentence should be.
   */
  name: string;
  /**
   * Clears the conflict, so the next one can raise the dialog again.
   *
   * Closing is not "resolved": the editor still holds unsaved values, and
   * whether to overwrite is a decision they make with the Save button.
   */
  onDismiss: () => void;
  onReload: () => Promise<void>;
  opened: Record<string, unknown>;
  spec: ContentFormSpec;
}) => {
  const t = useTranslations("core.content.conflict");
  const tGlobal = useTranslations("core.global");
  const [loading, setLoading] = React.useState(false);
  const reloaded = conflict.latest !== undefined;

  return (
    <AlertDialog
      onOpenChange={open => {
        if (!open) onDismiss();
      }}
      open
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          {/* Amber rather than destructive: nothing was lost, and nothing is
              about to be - the save simply did not happen. The same palette the
              `warning` alert variant uses, since there is no token for it. */}
          <AlertDialogMedia className="bg-amber-500/10">
            <TriangleAlertIcon
              aria-hidden
              className="text-amber-700 dark:text-amber-300"
            />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {reloaded
              ? t("reloaded", { version: conflict.currentVersion })
              : t("desc", { name, version: conflict.currentVersion })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {conflict.latest ? (
          <RemoteChanges latest={conflict.latest} opened={opened} spec={spec} />
        ) : null}

        <AlertDialogFooter>
          {/*
            Not an `AlertDialogAction`: that one closes the dialog, and this
            button's whole job is to replace the dialog's contents with what
            changed. Only the acknowledgement below closes.
          */}
          {!reloaded && (
            <Button
              disabled={loading}
              isLoading={loading}
              onClick={() => {
                setLoading(true);
                void onReload().finally(() => {
                  setLoading(false);
                });
              }}
              type="button"
              variant="outline"
            >
              {t("reload")}
            </Button>
          )}
          <AlertDialogAction onClick={onDismiss}>
            {tGlobal("close")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
