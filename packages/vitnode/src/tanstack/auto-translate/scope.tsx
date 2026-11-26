import type {
  AutoTranslateResponse,
  AutoTranslateSettings,
} from "@vitnode/api/content/auto-translate";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AUTO_TRANSLATE_MAX_ITEMS } from "@vitnode/api/content/auto-translate";
import React from "react";

import type { AutoTranslateItemRequest } from "./query";

import { useSessionQuery } from "../auth/session-query";
import { useLocale } from "../i18n/locale";
import {
  AUTO_TRANSLATE_DISABLED,
  autoTranslateSettingsQueryOptions,
  chunkAutoTranslateItems,
  lookupAutoTranslations,
  requestAutoTranslations,
} from "./query";
import { autoTranslateItemKey, AutoTranslateStore } from "./store";

/** How long a record must stay on screen before it is translated. */
export const AUTO_TRANSLATE_VISIBLE_MS = 300;
const BATCH_WINDOW_MS = 80;
const POLL_DELAYS_MS = [1500, 2000, 2500, 3000, 4000, 5000, 6000, 8000];
const MAX_POLLS = 20;

/** What a loader read for the page, so saved translations show on the first render. */
export interface AutoTranslateSnapshot {
  items: AutoTranslateItemRequest[];
  locale: string;
  response: AutoTranslateResponse | null;
  settings: AutoTranslateSettings;
}

interface AutoTranslateContextValue {
  /** Whether automatic mode is on for this reader right now. */
  auto: boolean;
  locale: string;
  /** Starts watching an element; translation is requested once it stays visible. */
  observe: (element: Element, item: string) => () => void;
  /**
   * Loads the saved translations of records about to render, and queues the
   * missing ones, in one request per 30 records - so a reader with automatic
   * translation on sees them translated on the first render. Call it before
   * the records render, e.g. in the query that loads them. Does nothing when
   * automatic translation is off, and never throws.
   */
  prime: (items: AutoTranslateItemRequest[]) => Promise<void>;
  /** Keeps the latest fingerprints of a rendered record, for requests and polling. */
  register: (target: AutoTranslateItemRequest) => () => void;
  settings: AutoTranslateSettings;
  store: AutoTranslateStore;
  translate: (
    target: AutoTranslateItemRequest,
  ) => Promise<AutoTranslateResponse | null>;
}

const AutoTranslateContext =
  React.createContext<AutoTranslateContextValue | null>(null);

export const useAutoTranslateContext = () =>
  React.useContext(AutoTranslateContext);

interface Observed {
  item: string;
  timer: null | ReturnType<typeof setTimeout>;
  visible: boolean;
}

/**
 * Translates the records rendered inside it as the reader scrolls. Saved
 * translations from `initial` show on the first render; records that become
 * visible for 300 ms are batched into one request, and pending ones are
 * polled until they are ready. Turning automatic mode off, changing language
 * or leaving the page stops requests and polling, and an answer that arrives
 * late is never shown for another language or another version of the text.
 *
 * @example
 * ```tsx
 * import { AutoTranslateScope } from "@vitnode/core/tanstack/auto-translate";
 *
 * <AutoTranslateScope initial={loaderData.translations}>
 *   <TopicList topics={topics} />
 * </AutoTranslateScope>;
 * ```
 */
export const AutoTranslateScope = ({
  children,
  initial,
}: {
  children: React.ReactNode;
  /**
   * From `loadAutoTranslateSnapshot()` in the route's loader. A new snapshot,
   * such as the next record when the route stays mounted, is merged in before
   * paint, so the scope needs no `key`.
   */
  initial?: AutoTranslateSnapshot | null;
}) => {
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data: session } = useSessionQuery();
  const viewerId = session?.user?.id ?? null;
  const settingsOptions = autoTranslateSettingsQueryOptions(viewerId);
  const { data } = useQuery(settingsOptions);
  const settings =
    data ??
    (initial && initial.locale === locale ? initial.settings : null) ??
    AUTO_TRANSLATE_DISABLED;
  const auto = settings.enabled && settings.auto;

  const [store] = React.useState(() => {
    const created = new AutoTranslateStore();
    if (initial?.response) created.ingest(initial.response, initial.items);

    return created;
  });
  const ingestedSnapshot = React.useRef(initial);
  React.useLayoutEffect(() => {
    if (ingestedSnapshot.current === initial) return;
    ingestedSnapshot.current = initial;
    if (initial?.response) store.ingest(initial.response, initial.items);
  }, [initial, store]);

  const live = React.useRef({ auto, locale, viewerId });
  React.useEffect(() => {
    live.current = { auto, locale, viewerId };
  }, [auto, locale, viewerId]);
  const targets = React.useRef(new Map<string, AutoTranslateItemRequest>());
  const batch = React.useRef(new Map<string, AutoTranslateItemRequest>());
  const flushTimer = React.useRef<null | ReturnType<typeof setTimeout>>(null);
  const polls = React.useRef(0);

  const send = React.useCallback(
    async (items: AutoTranslateItemRequest[]) => {
      const requestedLocale = live.current.locale;
      const response = await requestAutoTranslations({
        items,
        locale: requestedLocale,
        mode: "automatic",
      }).catch(() => null);
      if (!response) {
        for (const item of items) store.release(requestedLocale, item);

        return;
      }
      polls.current = 0;
      store.ingest(response, items);
    },
    [store],
  );

  const flush = React.useCallback(async () => {
    flushTimer.current = null;
    const items = [...batch.current.values()];
    batch.current.clear();
    await Promise.all(
      chunkAutoTranslateItems(items).map(async chunk => await send(chunk)),
    );
  }, [send]);

  const prime = React.useCallback(
    async (items: AutoTranslateItemRequest[]) => {
      if (items.length === 0) return;
      const { locale: primeLocale, viewerId: primeViewer } = live.current;
      const current = await queryClient
        .query(autoTranslateSettingsQueryOptions(primeViewer))
        .catch(() => null);
      if (!current?.enabled || !current.auto) return;

      const claimed = current.canGenerate
        ? items.flatMap(item => store.claimMissing(primeLocale, item) ?? [])
        : items.filter(item => {
            const key = autoTranslateItemKey(item.contentTypeId, item.id);

            return item.fields.some(
              field =>
                store.get(primeLocale, key, field.name, field.fingerprint) ===
                undefined,
            );
          });
      await Promise.all(
        chunkAutoTranslateItems(claimed).map(async chunk => {
          const response = await (
            current.canGenerate
              ? requestAutoTranslations({
                  items: chunk,
                  locale: primeLocale,
                  mode: "automatic",
                })
              : lookupAutoTranslations({ items: chunk, locale: primeLocale })
          ).catch(() => null);
          if (response) {
            store.ingest(response, chunk);

            return;
          }
          if (current.canGenerate) {
            for (const item of chunk) store.release(primeLocale, item);
          }
        }),
      );
    },
    [queryClient, store],
  );

  const enqueue = React.useCallback(
    (item: string) => {
      if (!live.current.auto) return;
      const target = targets.current.get(item);
      if (!target) return;
      const missing = store.claimMissing(live.current.locale, target);
      if (!missing) return;
      batch.current.set(item, missing);
      flushTimer.current ??= setTimeout(() => void flush(), BATCH_WINDOW_MS);
    },
    [flush, store],
  );

  const observed = React.useRef(new Map<Element, Observed>());
  const observer = React.useRef<IntersectionObserver | null>(null);
  const startTimer = React.useCallback(
    (state: Observed) => {
      state.timer ??= setTimeout(() => {
        state.timer = null;
        if (state.visible) enqueue(state.item);
      }, AUTO_TRANSLATE_VISIBLE_MS);
    },
    [enqueue],
  );

  const getObserver = React.useCallback(() => {
    if (observer.current || typeof IntersectionObserver === "undefined") {
      return observer.current;
    }
    observer.current = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const state = observed.current.get(entry.target);
        if (!state) continue;
        state.visible = entry.isIntersecting;
        if (entry.isIntersecting) {
          if (live.current.auto) startTimer(state);
        } else if (state.timer) {
          clearTimeout(state.timer);
          state.timer = null;
        }
      }
    });

    return observer.current;
  }, [startTimer]);

  React.useEffect(
    () => () => {
      observer.current?.disconnect();
      observer.current = null;
      for (const state of observed.current.values()) {
        if (state.timer) clearTimeout(state.timer);
      }
      observed.current.clear();
      if (flushTimer.current) clearTimeout(flushTimer.current);
      batch.current.clear();
    },
    [],
  );

  React.useEffect(() => {
    batch.current.clear();
    for (const state of observed.current.values()) {
      if (state.timer) clearTimeout(state.timer);
      state.timer = null;
      if (auto && state.visible) startTimer(state);
    }
  }, [auto, locale, startTimer]);

  const version = React.useSyncExternalStore(
    store.subscribe,
    store.getVersion,
    store.getVersion,
  );

  React.useEffect(() => {
    const pending = [...targets.current.values()].filter(target => {
      const key = autoTranslateItemKey(target.contentTypeId, target.id);

      return store.isManual(locale, key) && store.isPending(locale, target);
    });
    if (pending.length === 0 || polls.current >= MAX_POLLS) return;

    const controller = new AbortController();
    const delay =
      POLL_DELAYS_MS[Math.min(polls.current, POLL_DELAYS_MS.length - 1)];
    const timer = setTimeout(async () => {
      polls.current++;
      const items = pending.slice(0, AUTO_TRANSLATE_MAX_ITEMS);
      const response = await lookupAutoTranslations({
        items,
        locale,
        signal: controller.signal,
      }).catch(() => null);
      if (response && !controller.signal.aborted) store.ingest(response, items);
      else if (!controller.signal.aborted) store.touch();
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [locale, store, version]);

  const value = React.useMemo<AutoTranslateContextValue>(
    () => ({
      auto,
      locale,
      observe: (element, item) => {
        const io = getObserver();
        if (!io) return () => undefined;
        observed.current.set(element, { item, timer: null, visible: false });
        io.observe(element);

        return () => {
          const state = observed.current.get(element);
          if (state?.timer) clearTimeout(state.timer);
          observed.current.delete(element);
          io.unobserve(element);
        };
      },
      prime,
      register: target => {
        const key = autoTranslateItemKey(target.contentTypeId, target.id);
        targets.current.set(key, target);
        if (live.current.auto) {
          for (const state of observed.current.values()) {
            if (state.item === key && state.visible) startTimer(state);
          }
        }

        return () => {
          if (targets.current.get(key) === target) targets.current.delete(key);
        };
      },
      settings,
      store,
      translate: async target => {
        const key = autoTranslateItemKey(target.contentTypeId, target.id);
        store.setManual(locale, key);
        const ready = target.fields.every(
          field =>
            store.get(locale, key, field.name, field.fingerprint)?.state ===
            "ready",
        );
        if (ready) return null;

        polls.current = 0;
        const response = await requestAutoTranslations({
          items: [target],
          locale,
          mode: "manual",
        }).catch(() => null);
        if (response) store.ingest(response, [target]);

        return response;
      },
    }),
    [auto, getObserver, locale, prime, settings, startTimer, store],
  );

  return (
    <AutoTranslateContext.Provider value={value}>
      {children}
    </AutoTranslateContext.Provider>
  );
};
