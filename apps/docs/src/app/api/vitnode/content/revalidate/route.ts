/**
 * The web-side half of the Content Engine's background cache bridge.
 *
 * Needed because the API process cannot call `next/cache`: in a split
 * deployment it is plain Node, and even inside this app the queue runs in a
 * Route Handler where `updateTag` is unavailable. When a scheduled publish
 * makes a record public, this is what expires the tags.
 *
 * Authorized with `CRON_SECRET` and a timestamp window. The worst a valid
 * request can do is expire a cache tag.
 */
export { POST } from "@vitnode/core/content/next/revalidate-route";
