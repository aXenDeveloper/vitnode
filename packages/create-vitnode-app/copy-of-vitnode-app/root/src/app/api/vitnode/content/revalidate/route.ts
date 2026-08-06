/**
 * The web-side half of the Content Engine's background cache bridge.
 *
 * Needed because the API process cannot call `next/cache`. When a scheduled
 * publish makes a record public, this is what expires the tags so the page goes
 * live without waiting for the cache to age out.
 *
 * Authorized with `CRON_SECRET` and a timestamp window. The worst a valid
 * request can do is expire a cache tag. Delete this file only if you never use
 * [scheduled publishing](https://vitnode.com/docs/dev/content-engine/scheduling).
 */
export { POST } from "@vitnode/core/content/next/revalidate-route";
