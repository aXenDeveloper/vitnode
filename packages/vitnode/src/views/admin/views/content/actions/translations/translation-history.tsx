// No "use client": reached only from `edit-action`, already a client entry.
import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import type { ContentRevisionMeta } from "@/content/revisions";

import { DateFormat } from "@/components/date-format";
import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { Button } from "@/components/ui/button";
import { CONTENT_PERMISSIONS } from "@/content/const";

import { RevisionActor } from "../history/revision-actor";
import {
  listContentTranslationRevisionsAction,
  restoreContentTranslationRevisionAction,
} from "../translation-api.server";

/**
 * One locale's revision history, with restore.
 *
 * Deliberately its own component rather than a reuse of the shared
 * `RevisionHistory`: that one restores through the base editorial route and diffs
 * against the shared field list, and pointing it at a translation would offer to
 * restore English values into a Polish row. The read is scoped by locale on the
 * server, so this list structurally cannot show another language's versions.
 *
 * Restoring never changes publication state and never restores the historical
 * version number - the translation moves *forward* to a new version whose revision
 * records where the values came from.
 */
export const TranslationHistory = ({
  contentTypeId,
  currentVersion,
  itemId,
  locale,
  onRestored,
  permissionModule,
  pluginId,
}: {
  contentTypeId: string;
  currentVersion: number;
  itemId: number;
  locale: string;
  onRestored: () => void;
  permissionModule: string;
  pluginId: string;
}) => {
  const t = useTranslations("core.content.translations.history");
  const tHistory = useTranslations("core.content.history");
  const tErrors = useTranslations("core.global.errors");
  const canRestore = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.restore,
    plugin: pluginId,
  });

  const [open, setOpen] = React.useState(false);
  const [edges, setEdges] = React.useState<ContentRevisionMeta[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const page = await listContentTranslationRevisionsAction(
      contentTypeId,
      itemId,
      locale,
    );
    setEdges(page.edges);
    setLoading(false);
  }, [contentTypeId, itemId, locale]);

  const onToggle = () => {
    const next = !open;
    setOpen(next);
    // Loaded when the section is opened, not with the tab: a locale's history can
    // be long, and nobody who only wanted to fix a typo should pay for it.
    if (next && edges.length === 0) void load();
  };

  const onRestore = async (revisionId: number) => {
    setBusy(true);
    try {
      const result = await restoreContentTranslationRevisionAction(
        contentTypeId,
        itemId,
        locale,
        revisionId,
        currentVersion,
      );

      if (result.error !== undefined) {
        toast.error(tErrors("title"), {
          description: result.unprocessable
            ? t("not_restorable", {
                fields: result.unprocessable.fields.join(", "),
              })
            : t("restore_failed"),
        });

        return;
      }

      toast.success(t("restored"));
      await load();
      onRestored();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border-t pt-4">
      <Button onClick={onToggle} size="sm" variant="ghost">
        {open ? t("hide") : t("show")}
      </Button>

      {open ? (
        <ul className="mt-2 flex flex-col gap-2">
          {loading ? (
            <li className="text-sm">{tHistory("loading_more")}</li>
          ) : null}

          {!loading && edges.length === 0 ? (
            <li className="text-muted-foreground text-sm leading-relaxed">
              {t("empty")}
            </li>
          ) : null}

          {edges.map(revision => (
            <li
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
              key={revision.id}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {tHistory(
                    `operations.${revision.operation}` as Parameters<
                      typeof tHistory
                    >[0],
                  )}
                </span>
                <span className="text-muted-foreground">
                  v{revision.version}
                </span>
                <span className="text-muted-foreground">
                  <DateFormat date={new Date(revision.createdAt)} />
                </span>
                <RevisionActor
                  className="text-muted-foreground"
                  revision={revision}
                />
              </span>

              {canRestore && revision.version !== currentVersion ? (
                <Button
                  disabled={busy}
                  onClick={() => {
                    void onRestore(revision.id);
                  }}
                  size="sm"
                  variant="outline"
                >
                  {t("restore")}
                </Button>
              ) : (
                <span className="text-muted-foreground">
                  {revision.version === currentVersion
                    ? tHistory("current")
                    : null}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};
