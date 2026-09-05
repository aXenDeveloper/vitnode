# VitNode marketing pages

The homepage and `/pricing` use the shared marketing styles, navigation, canary
notice, and footer. The footer is mounted once in the main route layout, so it
also appears on public plugin pages, discover, search, and member settings.
Documentation keeps its Fumadocs shell.

## Content

- `home/home-content.tsx`: business benefits, plugins, AdminCP, community access,
  AI agents, security, deployment options, developer setup, and the maker.
- `home/visuals.tsx`: the feature bento and illustrative SVG/UI demos. The large
  AdminCP image is an existing product screenshot; community and agent cards
  are explicitly illustrative.
- `home/comparison.tsx`: a dated comparison with links to primary sources.
  Recheck those sources before changing a check mark or the checked date.
- `marketing/pricing.tsx`: the free MIT software licence, separately explained
  infrastructure costs, and frequently asked questions.

Claims follow the canary docs and source. Moderator permissions exist, but a
dedicated Moderator CP is not shipped. AI experiences require implementation
and a configured provider. The Vercel guide excludes the built-in WebSocket
server, local storage, and in-process cron. There is no managed VitNode cloud
plan or support SLA. Keep these distinctions when editing the copy.

## Accessibility and performance

Content renders on the server, including the hero and feature descriptions.
Decorative SVGs are hidden from assistive technology, and comparison statuses
include readable text. SVG animations run once, finish within five seconds,
and respect reduced motion. They do not add a JavaScript animation dependency.
Images have dimensions and load lazily below the hero.

Marketing colors are scoped and support light and dark themes. The existing
theme, language, and account controls remain available. Marketing copy is
currently English, matching the previous homepage.

## SEO

`marketing/metadata.ts` provides distinct titles, descriptions, Open Graph and
Twitter text, canonical URLs, and JSON-LD for the homepage and pricing page.
Structured data describes the actual open-source project, without invented
ratings or product maturity claims. No social image is added or replaced.

Canonical URLs use the official `https://vitnode.com` origin. Localized URLs
currently serve the same English marketing content and consolidate to the
unprefixed canonical. Add translated copy and matching locale canonicals before
adding hreflang alternates. The public `sitemap.xml` lists the marketing pages
and main documentation entry points; `robots.txt` advertises it. Keep both in
sync if canonical routes or the official domain change.
