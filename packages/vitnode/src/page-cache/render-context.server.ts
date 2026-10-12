import { AsyncLocalStorage } from "node:async_hooks";

import { decodePageCacheTags, PAGE_CACHE_TAGS_HEADER } from "./tags";

/** What one shared render read, collected while it runs. */
export interface PageCacheRenderState {
  /** An API response said it must not be shared - the page must not be. */
  isPrivate: boolean;
  tags: Set<string>;
}

const STORAGE_KEY = Symbol.for("vitnode.page-cache.render-context");

/**
 * One instance per process, however many copies of this module a bundler
 * produced: the server entry starts the render and the fetcher records into it,
 * and those two can be loaded from different chunks.
 */
const storage = (): AsyncLocalStorage<PageCacheRenderState> => {
  const holder = globalThis as typeof globalThis & {
    [STORAGE_KEY]?: AsyncLocalStorage<PageCacheRenderState>;
  };
  holder[STORAGE_KEY] ??= new AsyncLocalStorage<PageCacheRenderState>();

  return holder[STORAGE_KEY];
};

export const runPageCacheRender = async <T>(
  state: PageCacheRenderState,
  render: () => Promise<T>,
): Promise<T> => await storage().run(state, render);

const isPrivateResponse = (cacheControl: null | string): boolean =>
  cacheControl !== null && /\b(?:private|no-store)\b/i.test(cacheControl);

/**
 * Called by the server-side fetcher for every API response. Outside a shared
 * render it does nothing.
 */
export const recordPageCacheApiResponse = (response: {
  headers: Headers;
}): void => {
  const state = storage().getStore();
  if (state === undefined) return;

  for (const tag of decodePageCacheTags(
    response.headers.get(PAGE_CACHE_TAGS_HEADER),
  )) {
    state.tags.add(tag);
  }

  if (isPrivateResponse(response.headers.get("cache-control"))) {
    state.isPrivate = true;
  }
};
