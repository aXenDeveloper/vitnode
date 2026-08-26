import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { ContentFormFieldSpec } from "@/content/admin/spec";

/**
 * The cache namespace every `relation`/`user` picker fetches under.
 *
 * Its own prefix so a mutation can expire pickers and nothing else - the query
 * client is one client for the whole AdminCP, and a broad invalidation would
 * take every list and count on the screen with it.
 */
const NAMESPACE = "content-options";

/**
 * The bucket a `user` picker's options sit in.
 *
 * People are not a content type, so a `user` field has no `targetContentTypeId`
 * - and giving it a token of its own rather than falling back to the field name
 * is what keeps a content mutation from ever matching one: no content type is
 * called this, so `useInvalidateContentOptions` cannot reach it.
 */
const USERS = "core.users";

/**
 * Where one picker's options are cached.
 *
 * Keyed by **what it offers** before what it is called, so every field pointing
 * at the same content type shares a prefix and one mutation expires all of them.
 * The field name stays on the end because two fields onto the same target can
 * still be searched independently.
 */
export const contentOptionsQueryKey = (
  spec: ContentFormFieldSpec,
): unknown[] => [NAMESPACE, spec.targetContentTypeId ?? USERS, spec.name];

/**
 * Every picker that offers rows of one content type.
 *
 * A prefix of {@link contentOptionsQueryKey}, which is the whole point: TanStack
 * Query matches keys by prefix, so this reaches the category picker on an
 * article without either screen having to know the other exists.
 */
export const contentOptionsQueryKeyFor = (contentTypeId: string): unknown[] => [
  NAMESPACE,
  contentTypeId,
];

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
        queryKey: contentOptionsQueryKeyFor(contentTypeId),
      });
    },
    [queryClient],
  );
};
