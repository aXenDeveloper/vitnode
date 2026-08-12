// No "use client": reached only from `translations-action`, already a client entry.
import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import type { ContentTranslationConflict } from "@/content/conflicts";

import { DateFormat } from "@/components/date-format";
import { useLanguages } from "@/components/languages-provider";
import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { CONTENT_PERMISSIONS } from "@/content/const";

import type { TranslationRow } from "../translation-api.server";

import { contentErrorKey } from "../../lib/mutation-feedback";
import {
  deleteContentTranslationAction,
  listContentTranslationsAction,
  type TranslationMutationResult,
} from "../translation-api.server";
import { TranslationHistory } from "./translation-history";
import {
  translationStateOf,
  TranslationStatusBadge,
} from "./translation-status";

const conflictMessage = (
  conflict: ContentTranslationConflict | undefined,
): null | string => {
  switch (conflict?.code) {
    case "CONTENT_DEFAULT_TRANSLATION_REQUIRED":
      return "default_required";
    case "CONTENT_LANGUAGE_DISABLED":
      return "language_disabled";
    case "CONTENT_TRANSLATION_EXISTS":
      return "exists";
    case "CONTENT_TRANSLATION_UNIQUE_CONFLICT":
      return "unique_conflict";
    case "CONTENT_TRANSLATION_VERSION_CONFLICT":
      return "version_conflict";
    default:
      return null;
  }
};

/**
 * Per-language **lifecycle**, and nothing else.
 *
 * The values of every language are edited in the ordinary form, where each
 * localized input carries its own small language switcher. What is left over is
 * genuinely per-language and genuinely not a field: whether a translation is
 * published, what its history is, and whether it should exist at all.
 *
 * Those live here rather than in a tab strip around the form, because the
 * language is part of *this action* rather than a mode the whole screen is in.
 * Nothing about the backend changed: each row still has its own version, its own
 * revisions and its own publication state, reached through the same per-locale
 * routes it always was.
 */
export const TranslationManager = ({
  contentTypeId,
  defaultLocale,
  editorial,
  itemId,
  permissionModule,
  pluginId,
  publication,
}: {
  contentTypeId: string;
  /** The content type's default locale - its translation is never deletable. */
  defaultLocale: string;
  /** Enables the per-language history section. */
  editorial: boolean;
  itemId: number;
  permissionModule: string;
  pluginId: string;
  /**
   * Whether the content type has the publication lifecycle.
   *
   * Shows each language's state and the date it went out - read-only. A language
   * is published when the *record* is: `editorialService.publish` moves every
   * one of them with it, so there is nothing per-language left to decide here.
   */
  publication: boolean;
}) => {
  const t = useTranslations("core.content.translations");
  const tErrors = useTranslations("core.global.errors");
  const tContentErrors = useTranslations("core.content.errors");
  const languages = useLanguages();

  const canDelete = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.delete,
    plugin: pluginId,
  });

  const [rows, setRows] = React.useState<null | TranslationRow[]>(null);
  const [reloads, setReloads] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    void listContentTranslationsAction(contentTypeId, itemId).then(
      ({ edges }) => {
        if (active) setRows(edges);
      },
    );

    return () => {
      active = false;
    };
  }, [contentTypeId, itemId, reloads]);

  const reload = () => {
    setRows(null);
    setReloads(count => count + 1);
  };

  const run = async (
    mutate: () => Promise<TranslationMutationResult>,
    successKey: "deleted",
    name: string,
  ): Promise<void> => {
    setBusy(true);
    try {
      const result = await mutate();

      if (result.error !== undefined) {
        // The structured refusal first, because it names the language; only the
        // status is left to the shared mapper, and neither may quote the
        // database.
        const key = result.delivery
          ? "slug_reserved"
          : conflictMessage(result.conflict);
        const generic = contentErrorKey(result.status, {});

        toast.error(tErrors("title"), {
          description: key
            ? t(`errors.${key}` as Parameters<typeof t>[0])
            : generic
              ? tContentErrors(generic)
              : tErrors("internal_server_error"),
        });

        return;
      }

      toast.success(t(`success.${successKey}` as Parameters<typeof t>[0]), {
        description: name,
      });
      reload();
    } finally {
      setBusy(false);
    }
  };

  if (rows === null) return <Loader />;

  const rowFor = (locale: string): TranslationRow | undefined =>
    rows.find(row => row.locale.toLowerCase() === locale.toLowerCase());

  return (
    <ul className="flex flex-col gap-4">
      {languages.map(language => {
        const name = language.name ?? language.code;
        const row = rowFor(language.code);
        const isDefaultLocale =
          language.code.toLowerCase() === defaultLocale.toLowerCase();
        const state = translationStateOf({
          present: row !== undefined,
          status: publication ? (row?.status ?? "draft") : undefined,
        });
        const publishedAt =
          typeof row?.publishedAt === "string"
            ? new Date(row.publishedAt)
            : null;

        return (
          <li
            className="flex flex-col gap-2 border-b pb-4 last:border-b-0"
            key={language.code}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{name}</span>
              <TranslationStatusBadge state={state} />
              {row ? (
                <span className="text-muted-foreground text-sm">
                  {t("version", { version: row.version })}
                </span>
              ) : null}
              {publication && row ? (
                <span className="text-muted-foreground text-sm">
                  {publishedAt ? (
                    <DateFormat date={publishedAt} />
                  ) : (
                    t("never_published")
                  )}
                </span>
              ) : null}
            </div>

            {row ? (
              <div className="flex flex-wrap items-center gap-2">
                {canDelete && !isDefaultLocale ? (
                  <Button
                    disabled={busy}
                    onClick={() => {
                      void run(
                        async () =>
                          await deleteContentTranslationAction(
                            contentTypeId,
                            itemId,
                            language.code,
                            row.version,
                          ),
                        "deleted",
                        name,
                      );
                    }}
                    size="sm"
                    variant="destructive"
                  >
                    {t("delete", { name })}
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                {t("missing_hint", { name })}
              </p>
            )}

            {row && editorial ? (
              <TranslationHistory
                contentTypeId={contentTypeId}
                currentVersion={row.version}
                itemId={itemId}
                locale={language.code}
                onRestored={reload}
                permissionModule={permissionModule}
                pluginId={pluginId}
              />
            ) : null}

            {row && isDefaultLocale ? (
              <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                {t("default_locale_note", { name })}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
};
