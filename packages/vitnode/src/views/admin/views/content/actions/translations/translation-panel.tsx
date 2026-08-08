// No "use client": reached only from `edit-action`, already a client entry.
import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import type { ContentFormSpec } from "@/content/admin/spec";
import type { ContentTranslationConflict } from "@/content/conflicts";

import { DateFormat } from "@/components/date-format";
import { AutoForm, type AutoFormOnSubmit } from "@/components/form/auto-form";
import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { buildFormSchemaFromSpec } from "@/content/admin/spec";
import { CONTENT_PERMISSIONS } from "@/content/const";

import type {
  TranslationMutationResult,
  TranslationRow,
} from "../translation-api.server";

import { contentErrorKey } from "../../lib/mutation-feedback";
import {
  createContentTranslationAction,
  deleteContentTranslationAction,
  editContentTranslationAction,
  getContentTranslationAction,
  publishContentTranslationAction,
  unpublishContentTranslationAction,
} from "../translation-api.server";
import { TranslationHistory } from "./translation-history";
import {
  translationStateOf,
  TranslationStatusBadge,
} from "./translation-status";

export interface TranslationPanelProps {
  contentTypeId: string;
  /** Enables the history and restore sections. */
  editorial: boolean;
  /** `true` when this locale is the content type's default - never deletable. */
  isDefaultLocale: boolean;
  itemId: number;
  /** Human name of the language, for headings and toasts. */
  languageName: string;
  locale: string;
  /** Reloads the tab strip after a mutation, so its badges stay honest. */
  onMutated: () => void;
  permissionModule: string;
  pluginId: string;
  /** Enables the publish/unpublish controls. */
  publication: boolean;
  spec: ContentFormSpec;
}

/**
 * Turns a refusal into a sentence, without ever quoting the database.
 *
 * The version conflict is the one that gets special treatment: the form stays
 * exactly as the translator left it, and the banner offers to reload. Everything
 * else is a toast, because there is nothing to preserve.
 */
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
 * One locale's editing surface.
 *
 * Everything on it is scoped to this language and nothing else: the form holds
 * only localized fields, the version it sends back is this translation's own, and
 * the history it opens is this locale's. An English edit and a Polish edit touch
 * two different rows with two different counters, so they cannot conflict - which
 * is the property the whole tab strip is built on.
 *
 * A translation is **never** created just because a tab was opened. A locale with
 * no translation shows `Missing` and an explicit create button, gated on
 * `can_translate` - opening a tab to look is not a decision to publish an empty
 * Polish page.
 */
export const TranslationPanel = ({
  contentTypeId,
  editorial,
  isDefaultLocale,
  itemId,
  languageName,
  locale,
  onMutated,
  permissionModule,
  pluginId,
  publication,
  spec,
}: TranslationPanelProps) => {
  const t = useTranslations("core.content.translations");
  const tErrors = useTranslations("core.global.errors");
  const tContentErrors = useTranslations("core.content.errors");

  const canTranslate = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.translate,
    plugin: pluginId,
  });
  const canPublish = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.publish,
    plugin: pluginId,
  });
  const canDelete = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.delete,
    plugin: pluginId,
  });

  const [row, setRow] = React.useState<null | TranslationRow>(null);
  // Whether a read has come back at all, which is the only way to tell "still
  // loading" from "loaded, and this locale has no translation". Derived rather
  // than a `loading` flag so nothing sets state synchronously inside the effect.
  const [settled, setSettled] = React.useState(false);
  const [reloads, setReloads] = React.useState(0);
  const [stale, setStale] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  /**
   * Reads this locale's values whenever the tab, the record or a reload changes.
   *
   * Inlined rather than a memoised `load()` so the effect body writes no state
   * before its first `await` - a synchronous write here would cost a second render
   * pass on every tab switch. `active` drops a response that arrived after the
   * person had already moved to another language.
   */
  React.useEffect(() => {
    let active = true;

    void getContentTranslationAction(contentTypeId, itemId, locale).then(
      result => {
        if (!active) return;

        setRow(result.row ?? null);
        setStale(false);
        setSettled(true);
      },
    );

    return () => {
      active = false;
    };
  }, [contentTypeId, itemId, locale, reloads]);

  /** Re-reads this locale. Used after a mutation and by the conflict banner. */
  const reload = () => {
    setSettled(false);
    setReloads(count => count + 1);
  };

  const present = row !== null;
  const state = translationStateOf({
    present,
    status: publication ? (row?.status ?? "draft") : undefined,
  });

  // Rebuilt whenever the loaded values change, so the form prefills with what the
  // server has - and, after a reload following a conflict, with what it now has.
  const formSchema = React.useMemo(
    () => buildFormSchemaFromSpec(spec, row?.values),
    [spec, row?.values],
  );

  const report = (result: TranslationMutationResult): boolean => {
    if (result.error === undefined) return true;

    // The delivery reservation first: it shares a status with the unique clash and
    // says a different thing - "that address still redirects to another record"
    // rather than "another record holds it now".
    const key = result.delivery
      ? "slug_reserved"
      : conflictMessage(result.conflict);

    if (result.conflict?.code === "CONTENT_TRANSLATION_VERSION_CONFLICT") {
      // The form keeps every value the translator typed. Nothing is retried and
      // nothing is merged: reloading is a decision, and so is saving over what
      // the reload reveals.
      setStale(true);

      return false;
    }

    toast.error(tErrors("title"), {
      description: key
        ? t(`errors.${key}` as Parameters<typeof t>[0])
        : (() => {
            // Only the status: the structured half of a translation refusal is
            // handled above, and the shared mapper's union describes the *base*
            // conflict codes rather than these.
            const generic = contentErrorKey(result.status, {});

            return generic
              ? tContentErrors(generic)
              : tErrors("internal_server_error");
          })(),
    });

    return false;
  };

  /** Runs one mutation, then reloads this locale and the strip above it. */
  const run = async (
    mutate: () => Promise<TranslationMutationResult>,
    successKey: "created" | "deleted" | "published" | "saved" | "unpublished",
  ): Promise<boolean> => {
    setBusy(true);
    try {
      const result = await mutate();
      if (!report(result)) return false;

      toast.success(t(`success.${successKey}` as Parameters<typeof t>[0]), {
        description: languageName,
      });

      reload();
      onMutated();

      return true;
    } finally {
      setBusy(false);
    }
  };

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    // No relation or user fields here - only text, textarea and slug can be
    // localized - so the values go through as they are.
    const payload = values;

    if (row) {
      await run(
        async () =>
          await editContentTranslationAction(
            contentTypeId,
            itemId,
            locale,
            payload,
            row.version,
          ),
        "saved",
      );

      return;
    }

    await run(
      async () =>
        await createContentTranslationAction(
          contentTypeId,
          itemId,
          locale,
          payload,
        ),
      "created",
    );
  };

  if (!settled) return <Loader />;

  const publishedAt =
    typeof row?.publishedAt === "string" ? new Date(row.publishedAt) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <TranslationStatusBadge state={state} />
        {publication && present ? (
          <span className="text-muted-foreground">
            {publishedAt ? (
              <DateFormat date={publishedAt} />
            ) : (
              t("never_published")
            )}
          </span>
        ) : null}
        {present ? (
          <span className="text-muted-foreground">
            {t("version", { version: row.version })}
          </span>
        ) : null}
      </div>

      {stale && row ? (
        <Alert variant="destructive">
          <AlertTitle>{t("conflict.title", { name: languageName })}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <p className="text-pretty">{t("conflict.desc")}</p>
            <Button
              disabled={busy}
              onClick={reload}
              size="sm"
              variant="outline"
            >
              {t("conflict.reload")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!present && !canTranslate ? (
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("missing_readonly", { name: languageName })}
        </p>
      ) : null}

      {canTranslate ? (
        <AutoForm
          fields={spec.fields.map(fieldSpec => ({ id: fieldSpec.name }))}
          formSchema={formSchema}
          onSubmit={onSubmit}
          submitButtonProps={{
            children: present ? t("save") : t("create"),
            disabled: busy,
          }}
        />
      ) : null}

      {present && publication && canPublish ? (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() => {
              void run(
                async () =>
                  state === "published"
                    ? await unpublishContentTranslationAction(
                        contentTypeId,
                        itemId,
                        locale,
                        row.version,
                      )
                    : await publishContentTranslationAction(
                        contentTypeId,
                        itemId,
                        locale,
                        row.version,
                      ),
                state === "published" ? "unpublished" : "published",
              );
            }}
            size="sm"
            variant={state === "published" ? "outline" : "default"}
          >
            {state === "published" ? t("unpublish") : t("publish")}
          </Button>
        </div>
      ) : null}

      {present && editorial ? (
        <TranslationHistory
          contentTypeId={contentTypeId}
          currentVersion={row.version}
          itemId={itemId}
          locale={locale}
          onRestored={() => {
            reload();
            onMutated();
          }}
          permissionModule={permissionModule}
          pluginId={pluginId}
        />
      ) : null}

      {present && !isDefaultLocale && canDelete ? (
        <div className="border-t pt-4">
          <Button
            disabled={busy}
            onClick={() => {
              void run(
                async () =>
                  await deleteContentTranslationAction(
                    contentTypeId,
                    itemId,
                    locale,
                    row.version,
                  ),
                "deleted",
              );
            }}
            size="sm"
            variant="destructive"
          >
            {t("delete", { name: languageName })}
          </Button>
        </div>
      ) : null}

      {present && isDefaultLocale ? (
        <p className="text-muted-foreground border-t pt-4 text-sm leading-relaxed text-pretty">
          {t("default_locale_note", { name: languageName })}
        </p>
      ) : null}
    </div>
  );
};
