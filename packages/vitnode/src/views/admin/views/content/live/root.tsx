import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { ContentFormSpec } from "@/content/admin/spec";
import type { ContentDrafts } from "@/content/live/http";

import { CONTENT_DRAFT_AUTOSAVE_MS } from "@/content/live/protocol";

import type { ContentRow, TranslationRow } from "../content-mutation";
import type {
  ContentLiveAutosaveStatus,
  ContentLiveContextValue,
} from "./context";
import type { ContentLiveResetReason } from "./use-session";

import { useContentFormNavigation } from "../form/navigation";
import { useContentFormTransport } from "../form/transport";
import { ContentLiveContext } from "./context";
import { createContentRichTextRegistry } from "./rich-text";
import { useContentLiveSession } from "./use-session";
import {
  contentDraftDiffers,
  contentDraftMovedReferences,
  contentDraftValue,
  mergeContentDraft,
} from "./values";

export interface ContentLiveFormState {
  drafts: ContentDrafts | null;
  labels: Record<string, string>;
  row: ContentRow;
  translations: readonly TranslationRow[];
}

interface Reloaded {
  for: ContentRow;
  row: ContentRow;
  translations: readonly TranslationRow[];
}

interface PendingValue {
  field: string;
  locale: null | string;
  value: unknown;
}

const OWN_DISCARD_ECHO_MS = 5_000;

const IDLE: ContentLiveAutosaveStatus = {
  dirty: false,
  failed: false,
  savedAt: null,
  saving: false,
};

export const ContentLiveRoot = ({
  children,
  data,
  fallback,
  spec,
  translations,
}: {
  children: (state: ContentLiveFormState) => React.ReactNode;
  data: ContentRow;
  fallback: React.ReactNode;
  spec: ContentFormSpec;
  translations: readonly TranslationRow[];
}) => {
  const t = useTranslations("core.content.live");
  const transport = useContentFormTransport();
  const { refresh } = useContentFormNavigation();
  const contentTypeId = spec.contentTypeId;
  const itemId = data.id;
  const session = useContentLiveSession({
    contentTypeId,
    itemId,
    locale: spec.defaultLocale,
  });
  const { onCommitted, onDraft, onReset, readDrafts } = session;

  const [coEditing, setCoEditing] = React.useState(false);
  if (session.live && !coEditing) setCoEditing(true);
  const [richText] = React.useState(createContentRichTextRegistry);

  const [opening, setOpening] = React.useState<
    undefined | { drafts: ContentDrafts | null; labels: Record<string, string> }
  >(undefined);
  const [drafts, setDrafts] = React.useState<ContentDrafts | null>(null);
  const [reloaded, setReloaded] = React.useState<null | Reloaded>(null);
  const [generation, setGeneration] = React.useState(0);
  const [status, setStatus] =
    React.useState<Omit<ContentLiveAutosaveStatus, "dirty">>(IDLE);

  const row = reloaded?.for === data ? reloaded.row : data;
  const rows = reloaded?.for === data ? reloaded.translations : translations;

  const draftsRef = React.useRef(drafts);
  React.useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  const load = React.useEffectEvent(async (base?: ContentRow) => {
    const read = await readDrafts();
    const moved = contentDraftMovedReferences(spec, base ?? row, read);
    const found = await Promise.all(
      moved.map(async ({ field, id }) => {
        const [option] = await transport.loadOptions(contentTypeId, field, "", [
          id,
        ]);

        return option ? ([[field, option.label]] as const) : [];
      }),
    );

    return { labels: Object.fromEntries(found.flat()), read };
  });

  React.useEffect(() => {
    let active = true;

    void load().then(result => {
      if (!active) return;
      setOpening({ drafts: result.read, labels: result.labels });
      setDrafts(result.read);
    });

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(
    () =>
      onDraft(event => {
        setDrafts(current => mergeContentDraft(current, event));
      }),
    [onDraft],
  );

  const reloadDrafts = React.useCallback(async () => {
    setDrafts(await readDrafts());
  }, [readDrafts]);

  React.useEffect(
    () =>
      onCommitted(() => {
        void reloadDrafts();
      }),
    [onCommitted, reloadDrafts],
  );

  const pendingRef = React.useRef(new Map<string, PendingValue>());
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const chainRef = React.useRef<Promise<void>>(Promise.resolve());

  const saveNow = React.useCallback(async () => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;

    const batch = [...pendingRef.current.values()];
    pendingRef.current.clear();
    if (batch.length === 0) return;

    const byLocale = new Map<null | string, Record<string, unknown>>();
    for (const { field, locale, value } of batch) {
      byLocale.set(locale, { ...byLocale.get(locale), [field]: value });
    }

    setStatus(current => ({ ...current, saving: true }));
    let failed = false;
    let savedAt: null | string = null;

    for (const [locale, values] of byLocale) {
      const result = await transport.saveDraft(contentTypeId, itemId, {
        locale,
        values,
      });

      if (result.updatedAt === undefined) {
        failed = true;
        continue;
      }

      const updatedAt = result.updatedAt;
      savedAt = updatedAt;
      setDrafts(current =>
        mergeContentDraft(current, {
          by: null,
          locale,
          updatedAt,
          values,
        }),
      );
    }

    setStatus(current => ({
      failed,
      saving: false,
      savedAt: savedAt ?? current.savedAt,
    }));
  }, [contentTypeId, itemId, transport]);

  const flush = React.useCallback(async () => {
    chainRef.current = chainRef.current.then(saveNow, saveNow);
    await chainRef.current;
  }, [saveNow]);

  const queue = React.useCallback(
    (field: string, locale: null | string, value: unknown) => {
      const key = `${locale ?? ""}\u0000${field}`;
      const stored = contentDraftValue(draftsRef.current, field, locale);

      if (stored && JSON.stringify(stored.value) === JSON.stringify(value)) {
        pendingRef.current.delete(key);

        return;
      }

      pendingRef.current.set(key, { field, locale, value });
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, CONTENT_DRAFT_AUTOSAVE_MS);
    },
    [flush],
  );

  React.useEffect(
    () => () => {
      void flush();
    },
    [flush],
  );

  const ownDiscardRef = React.useRef<"handled" | "idle" | "pending">("idle");

  const reset = React.useEffectEvent(
    async (reason: ContentLiveResetReason, own: boolean) => {
      pendingRef.current.clear();
      clearTimeout(timerRef.current);

      if (reason === "deleted") {
        toast.warning(t("reset.deleted.title"), {
          description: t("reset.deleted.desc"),
        });
        refresh();

        return;
      }

      const [fresh, list] = await Promise.all([
        transport.reloadRow(contentTypeId, itemId),
        spec.defaultLocale === null
          ? Promise.resolve({ edges: [...rows] })
          : transport.listTranslations(contentTypeId, itemId),
      ]);
      const next = fresh.row ? { ...data, ...fresh.row } : row;
      const { labels, read } = await load(next);

      setReloaded({ for: data, row: next, translations: list.edges });
      setOpening({ drafts: read, labels });
      setDrafts(read);
      setStatus(IDLE);
      setGeneration(current => current + 1);
      if (own) {
        toast.success(t("reset.discarded_own.title"), {
          description: t("reset.discarded_own.desc"),
        });
      } else {
        toast.info(t(`reset.${reason}.title`), {
          description: t(`reset.${reason}.desc`),
        });
      }
      refresh();
    },
  );

  const discard = async (): Promise<boolean> => {
    pendingRef.current.clear();
    clearTimeout(timerRef.current);
    ownDiscardRef.current = "pending";

    const result = await transport.discardDraft(contentTypeId, itemId);
    if (result.error !== undefined) {
      ownDiscardRef.current = "idle";
      toast.error(t("status.discard_failed"));

      return false;
    }

    if (ownDiscardRef.current === "pending") session.resetLocally("discarded");
    window.setTimeout(() => {
      ownDiscardRef.current = "idle";
    }, OWN_DISCARD_ECHO_MS);

    return true;
  };

  React.useEffect(
    () =>
      onReset(reason => {
        const own = reason === "discarded" && ownDiscardRef.current !== "idle";
        if (own && ownDiscardRef.current === "handled") return;
        if (own) ownDiscardRef.current = "handled";
        void reset(reason, own);
      }),
    [onReset],
  );

  if (opening === undefined) return <>{fallback}</>;

  const value: ContentLiveContextValue = {
    autosave: { flush, queue },
    coEditing,
    discard,
    itemId,
    locale: spec.defaultLocale,
    reloadDrafts,
    richText,
    session,
    spec,
    status: { ...status, dirty: contentDraftDiffers(row, rows, drafts) },
  };

  return (
    <ContentLiveContext value={value}>
      <React.Fragment key={generation}>
        {children({ ...opening, row, translations: rows })}
      </React.Fragment>
    </ContentLiveContext>
  );
};
