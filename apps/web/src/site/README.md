# VitNode marketing pages

The homepage (`/`) and `/pricing` are the marketing surface of `apps/web`. Both
share the footer mounted in `routes/_main.tsx`, so the footer also appears on
public core pages such as Discover, Search and member settings. Documentation
keeps its own Fumadocs shell.

## Layout

- `home/home-content.tsx` composes the homepage from `home/sections/*`, one
  file per section: hero, tools strip, outcomes, the features bento grid, the
  plugin system, the AdminCP showcase, community, AI agents, security, hosting,
  the comparison table, the developer quick start, the maker note and the
  closing call to action.
- `home/illustrations/*` holds the animated SVGs. They are styled with Tailwind
  `fill-*` and `stroke-*` utilities so they follow the light and dark theme, and
  animated with the `mk-anim-*` keyframes from `marketing/marketing.css`.
  Every animation loops forever and pauses under `prefers-reduced-motion`.
- `marketing/shared.tsx` has the building blocks: section wrapper, headings,
  the primary actions, text links and the canary notice.
- `marketing/pricing.tsx` is the pricing page, `marketing/footer.tsx` the
  footer, `marketing/links.ts` the external URLs used across both pages.

## Claims

Copy follows the canary docs. Keep these distinctions when editing:

- A dedicated Moderator CP is on the roadmap. Moderator roles and permissions
  already exist.
- AI features are building blocks over the Vercel AI SDK, not a finished
  assistant, and need a configured provider.
- The Vercel guide does not cover the built-in WebSocket server, local uploads
  or in-process cron. There is no managed VitNode cloud plan or support SLA.
- The comparison table is dated. Recheck the compared products before changing
  a check mark, and update the "checked in" note.

## SEO

`marketing/metadata.ts` builds the `head` for both pages: title and
description, canonical URL, Open Graph and Twitter tags, a brand theme color
and JSON-LD describing the open-source project (plus a zero-price Offer and a
breadcrumb list on the pricing page). `public/robots.txt` and
`public/sitemap.xml` point crawlers at the marketing and documentation entry
points. Keep both in sync when the official domain or canonical routes change.

## Screenshots

`home/assets/admin-dashboard-*.png` are real AdminCP captures of the canary
dashboard in light and dark themes, cropped to hide development tooling. The
showcase section swaps them with `dark:` variants so the screenshot follows the
visitor's theme.
