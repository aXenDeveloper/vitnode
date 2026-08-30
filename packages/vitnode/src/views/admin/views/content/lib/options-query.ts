import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { ContentFormFieldSpec } from "@/content/admin/spec";

import {
  CONTENT_USER_TARGET,
  contentOptionsQueryKey as contentOptionsKeyFor,
  contentOptionsQueryRoot,
} from "../content-query";

/** What a picker offers: a content type's rows, or people. */
export const contentOptionsTarget = (spec: ContentFormFieldSpec): string =>
  spec.targetContentTypeId ?? CONTENT_USER_TARGET;

/**
 * Where one `relation`/`user` picker's options are cached.
 *
 * The key itself lives in `../content-query`, with the rest of the Content
 * Engine's family; this is the spec-shaped door onto it, because a field
 * component has a {@link ContentFormFieldSpec} in hand rather than a target id
 * and a field name. It resolves the target and forwards - it does not spell a
 * second key, which is how the family stayed reachable by one prefix.
 *
 *     [...contentOptionsQueryRoot(target), field, locale]   ← this
 *                                                 + {search}  ← the combobox
 *
 * Why the locale is in it and the search is not is the key's own business, and
 * `contentOptionsQueryKey` in `../content-query` states both. What this door
 * adds is the one decision a spec makes: a `user` field has no target content
 * type, so it goes to {@link CONTENT_USER_TARGET} rather than falling back to
 * the field name - a token no content type id can collide with, which is what
 * stops a content mutation ever matching a people picker.
 *
 * The locale it costs: a content type whose labels are *not* localized gets one
 * cache entry per AdminCP language holding identical options. That is the cheap
 * side of the trade - the alternative is a picker showing names in a language
 * the rest of the screen is not - and a field spec carries nothing that could
 * tell the two cases apart.
 *
 * ## This family used to sit outside the AdminCP cache root
 *
 * It was `["content-options", target, field]` - a bare string matching no prefix
 * anything drops. `removeAdminShellQueries` clears `["vitnode","admin"]` on
 * sign-out and never collected these, so one administrator's picker results
 * stayed in memory and were served to the next person to sign in on that tab.
 * Moving the family under the admin root fixes that with no list for anybody to
 * remember, which is the only kind of fix that stays fixed.
 */
export const contentOptionsQueryKey = (
  spec: ContentFormFieldSpec,
  locale: string,
): readonly unknown[] =>
  contentOptionsKeyFor(contentOptionsTarget(spec), spec.name, locale);

/**
 * Every picker that offers rows of one content type.
 *
 * A prefix of {@link contentOptionsQueryKey}, which is the whole point: TanStack
 * Query matches keys by prefix, so this reaches the category picker on an
 * article without either screen having to know the other exists.
 */
export const contentOptionsQueryKeyFor = (
  contentTypeId: string,
): readonly unknown[] => contentOptionsQueryRoot(contentTypeId);

/**
 * Drops the cached options of every picker that offers rows of one content
 * type - what a create, an edit or a delete owes the rest of the AdminCP.
 *
 * The query client is one client for the whole app and it outlives every
 * navigation, so without this a category created on the categories screen is
 * simply absent from the article form's picker until the next full page load -
 * and a renamed one keeps its old name, and a deleted one stays on offer.
 *
 * `removeQueries` rather than `invalidateQueries`, and that is not a detail: the
 * AdminCP's client is configured `refetchOnMount: false`, so a query that is
 * merely *marked* stale is still served from the cache when the form mounts. A
 * picker nobody is looking at has to lose its data, not its freshness flag.
 * Removing it also means the refetch happens when somebody opens the form rather
 * than for every form they have opened today.
 */
export const useInvalidateContentOptions = (): ((
  contentTypeId: string,
) => void) => {
  const queryClient = useQueryClient();

  return React.useCallback(
    (contentTypeId: string) => {
      queryClient.removeQueries({
        queryKey: contentOptionsQueryRoot(contentTypeId),
      });
    },
    [queryClient],
  );
};
