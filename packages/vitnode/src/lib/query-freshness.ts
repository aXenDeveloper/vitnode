/**
 * How long a route's cached read may be trusted before a revisit refreshes it.
 *
 * ## The gap these close
 *
 * A route loader reads through `ensureQueryData`, which returns whatever is
 * cached the moment anything is cached. With `refetchOnMount` and
 * `refetchOnWindowFocus` both off - deliberately, so a page never moves under
 * its reader - that made a revisited route show the data from the first visit
 * *indefinitely*. Nothing else was going to correct it: a mutation invalidates
 * what it changed, but only for the person who performed it, and a reconnect
 * only happens if the network dropped. Navigate away, come back an hour later,
 * and the cron table still says what it said an hour ago.
 *
 * The fix is not to turn the global refetch triggers back on. Those are off
 * because a *mount* is not evidence that anything changed, and re-enabling them
 * would reintroduce exactly the page-moves-under-you behaviour they were turned
 * off to stop. What a revisit needs is owned by the loader, which is the one
 * layer that knows a navigation happened.
 *
 * ## The contract, in two halves
 *
 * A `staleTime` from this file says *how long* an answer stays good.
 * `revalidateIfStale: true` at the loader says *what to do* once it is not:
 * hand the cached data straight to the page and refresh it behind them. So a
 * revisit is never slower than it is today, and the screen corrects itself a
 * moment later rather than being wrong until something else happens.
 *
 * Both halves are needed, and the `staleTime` is what makes it safe. The router
 * runs with `defaultPreload: 'intent'` and `defaultPreloadStaleTime: 0`, so a
 * loader runs on *hover*. Without a window, "always stale" would mean a
 * background refetch for every link a pointer crossed - the same hover storm
 * `ADMIN_SESSION_PRELOAD_STALE_TIME` exists to prevent, arrived at from the
 * other direction.
 *
 * ## Two windows, because there are two kinds of staleness
 *
 * Named rather than written at each call site so the *classification* is
 * reviewable in one place, and imported rather than copied so a family cannot
 * drift into a number nobody chose. Which window a family takes is still
 * declared in that family's own module, next to the rest of its policy.
 *
 * ## What does not appear here
 *
 * Genuinely stable data keeps its existing longer-lived caching and is not on
 * this list: message catalogues (`staleTime: Infinity` - a locale's strings
 * change when the app is redeployed), the middleware config's five minutes, and
 * the admin session, whose `0` is a revocation guarantee and the one value in
 * VitNode that must not be relaxed. Adding revalidation to those would be
 * refetching data that has not changed.
 */

/**
 * Data that moves on its own, with nobody on the screen touching it.
 *
 * Cron runs fire, queue jobs drain, log lines arrive, a search re-index makes
 * progress. An administrator on one of these screens is *watching state change*,
 * so an answer goes out of date without anybody acting - which is why the window
 * is the short one. Fifteen seconds is long enough that crossing a sidebar full
 * of links costs nothing and short enough that coming back to a running job
 * shows a running job.
 */
export const OPERATIONAL_STALE_TIME = 15_000;

/**
 * Data that changes only when a person edits it.
 *
 * User lists, roles, staff, uploaded files, integrations, Content Engine records
 * and a visitor's own files and devices. A write performed *here* already
 * invalidates its own family the moment it succeeds, precisely and by prefix, so
 * this window is not what keeps the editor's own screen correct - it is what
 * catches the edit somebody *else* made, or the one this person made in another
 * tab. That is a slower kind of staleness and it takes the longer window.
 *
 * A minute, deliberately not less: shortening it would not make a colleague's
 * edit arrive meaningfully sooner, and would spend requests on the overwhelming
 * majority of revisits where nothing has changed at all.
 */
export const RECORD_STALE_TIME = 60_000;
