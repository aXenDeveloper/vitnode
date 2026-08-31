import type { QueryClient } from "@tanstack/react-query";

import { DEVICES_IDENTITY_ROOT } from "@/views/auth/settings/devices/devices-query";
import { MY_FILES_IDENTITY_ROOT } from "@/views/files/my-files-query";

/**
 * Everything private this browser holds about *the previous visitor*, dropped.
 *
 * The public half of the pair whose other half is `removeAdminIdentityQueries`
 * in `tanstack/admin/queries`, and it exists because the two halves of the
 * application disagreed. The AdminCP has dropped its privileged entries at every
 * identity boundary since Stage 12; the public app dropped none of its own, so a
 * visitor's file names and their device list - operating systems, browsers, IP
 * addresses, sign-in times - stayed in the browser heap after they signed out.
 *
 * ## Why partitioning was not already enough
 *
 * Both families are keyed by owner (`myFilesQueryRoot`, `devicesQueryKey`), and
 * that is load-bearing: it is what stops visitor B *reading* visitor A's entry
 * on a shared tab, immediately and without anything having to run. So this is
 * residency rather than leakage, and it is worth being exact about the
 * difference rather than overstating the fix.
 *
 * What partitioning does not do is remove the data. A shared browser holds A's
 * private rows for the default five-minute `gcTime` after A has gone, readable
 * by anything with a debugger and dehydrated into nothing - but present. That is
 * precisely the property `removeAdminShellQueries` exists to deny the AdminCP,
 * and there is no argument for why a file listing deserves less than a cron
 * list.
 *
 * ## Prefixes, above the partitions
 *
 * `["files","user"]` and `["devices","user"]` - the roots *above* every owner's
 * partition, not one owner's. An identity boundary cannot name whose data to
 * drop: the whole event is that who this browser belongs to has become
 * uncertain, and a sign-in has no previous owner to name at all. Dropping the
 * wider prefix is the only spelling that collects a visitor who signed out two
 * sign-ins ago.
 *
 * The two roots come from the modules that build the keys, so a partition scheme
 * that changes has one place to change and this cleanup cannot quietly start
 * matching nothing.
 *
 * ## Removal, not invalidation
 *
 * `removeQueries` throughout, for the reason the admin side states: invalidation
 * keeps the value and marks it stale, so the next render still paints the
 * previous visitor's rows until a refetch returns. Removal deletes them, so
 * there is nothing to render from.
 *
 * ## What it does not touch
 *
 * Two prefixes, deliberately, and never `queryClient.clear()`. The session entry
 * is not on this list - `./session-query` owns its lifecycle, and a sign-out
 * *writes* the anonymous session rather than dropping it so that every guard and
 * header reading it sees a signed-out visitor rather than nothing at all. The
 * message catalogues, the middleware config and a plugin's own entries are not
 * this function's to throw away either: they are public, they are identical for
 * every visitor, and collecting them would turn a sign-in into a full-cache
 * eviction that re-fetches the whole application.
 *
 * Anything the public app caches per-visitor in future belongs on this list, and
 * this is the only place it is written down.
 */
export const removeUserIdentityQueries = (queryClient: QueryClient): void => {
  queryClient.removeQueries({ queryKey: MY_FILES_IDENTITY_ROOT });
  queryClient.removeQueries({ queryKey: DEVICES_IDENTITY_ROOT });
};
