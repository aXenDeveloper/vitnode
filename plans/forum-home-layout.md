# Forum home layout - decided from /proto/forum-home

Two prototype rounds behind a picker, then the pick. The prototype is deleted;
this note is what is left of it.

## Decision: Cards

- Every topic is its own card (`bg-card rounded-xl border shadow-xs`, 12px
  apart) instead of rows in one bordered list. Shared by `/forum` and every
  forum page (`TopicFeed`).
- The forum's icon sits on the card's left edge (from `sm`), the meta line on
  top: forum (bold), author with avatar, age.
- Title `text-xl` semibold, excerpt clamped to three lines.
- A footer bar under a border: points pill and reactions on the left, a ghost
  "N comments" link to `#comments` on the right.
- Meta dots belong to the item after them and the line is clipped by one dot,
  so a wrapped line never starts with a stray "·".
- `/forum` sidebar sticks under the header (`lg:top-20`) and opens with an
  "about" card: the forum description, topic and comment totals and the New
  topic button. The forum tree follows in its own card. The page header keeps
  only the title; New topic shows there below `lg`, where the sidebar is
  hidden.
- Dropped: "Last comment … ago" on the card (the Active sort covers it).

## Rejected

Round 1 (whole-page directions):

- **Board** (Invision index first, feed shrunk to three "trending" cards):
  the feed - the reason for the redesign - fell below the fold.
- **Compact** (one row per topic, columns): no excerpt or reactions; titles cut
  on phones.
- **Editorial** (lead story, story grid, "latest" column): long forum titles ate
  the page, and the hierarchy is curated, not ranked.
- **Channels** (Discord-like list filtering in place): weaker URLs and SEO, no
  forum pages to share.

Round 2 (riffs on the then-current page, a feed in one bordered list):

- **Rail** (sticky left tree, right rail with top of the week): the right rail
  only fits from 1280px; below that its content disappears.
- **Density** (Cards/Compact switch): one more control for a choice few
  readers make.
- **Focus** (one column, composer prompt, forum strip): flattens the forum
  tree; subforums lose their place.
- **Cards** was picked here, then explored in round 3.

Round 3 (riffs on Cards):

- **Score** (points as a tall tinted column on the card's edge): a column of
  "0" on fresh topics reads empty, and it costs width on phones.
- **People** (author-first post with a share button): the forum, the thing a
  forum is organised by, became small print.
- **Grid** (two-column cards): titles clamp to three lines and short topics
  next to long ones leave holes.
- **Soft** (borderless tinted cards): weak separation on bright screens; the
  bordered card read clearer.
