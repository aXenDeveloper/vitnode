// No "use client" here on purpose, for the same reason `content-form` has
// none: this is only reached from a client entry, and declaring it again would
// make it a nested one that `next/dynamic` cannot resolve from a package.
import { TriangleAlertIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

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

export const ConflictNotice = ({
  conflict,
  name,
  onDismiss,
  onReload,
  opened,
  spec,
}: {
  conflict: ContentConflictState;
  name: string;
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
