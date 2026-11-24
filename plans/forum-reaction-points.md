# Forum: points from reactions

Status: planned, not started. Owner: `@vitnode/forum` (no core changes).

No up/down voting and no Reddit-style rating. Members keep reacting the way
they do today, and each reaction is worth the **points** an admin gave it in
**AdminCP → Reactions** (`like` +1, `thanks` +2, `sad` 0, `disagree` -1 …).
A topic's or comment's points are the sum of its reactions' points - the same
number its author earned as reputation from it. Points rank the feed and the
comments.

## What changes from today

The feed (`GET /forum/feed`, Hot/New/Active/Top) already ranks by "points",
but they are a stand-in: every reaction counts `+1`, a negative reaction `-1`,
whatever its configured value, and reactions to one's own post count too.

| Today                                         | After                                                         |
| --------------------------------------------- | ------------------------------------------------------------- |
| `thanks` (+2) counts +1, `sad` (0) counts +1  | Each reaction counts its own `points`                         |
| Self reactions count                          | Ignored, like reputation                                      |
| Read from `core_reactions_counts`             | Read from `core_reactions_entries` (`targetAuthorId` set)     |
| Card shows "N points" only                    | Card shows the reaction bar and a points badge                |
| Topic page and comments show no points        | Points next to the reaction bar                               |
| Comments in posting order only                | Sort comments: Oldest (default), Newest, Most points          |

## Decisions

| Topic                | Decision                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formula              | `points = sum(core_reactions.points)` over the target's entries with `targetAuthorId is not null` - the exact rule of `lib/reactions/reputation.ts`, so a topic's points and its author's reputation never disagree. |
| Self reactions       | Don't count (`targetAuthorId` is null for them).                                                                                                                                                                           |
| Deleted author       | `targetAuthorId` becomes null, so the topic drops to 0 points - the same as the reputation it no longer gives anyone. Accepted.                                                                                         |
| Disabled reaction    | Still counts, as it does for reputation. Deleting the reaction removes its rows and its points.                                                                                                                         |
| Changing a reaction's points in AdminCP | Retroactive at once - points are summed on read, nothing to recount. The feed catches up within its one-minute cache bucket.                                                                          |
| Hot                  | `engagement = points + comments`, log scale against age (unchanged formula, new points).                                                                                                                                 |
| Top                  | Points, then comments, then newest.                                                                                                                                                                                       |
| Negative points      | Allowed: a topic full of `disagree` sinks in Hot and Top. Shown with its sign (`-3`).                                                                                                                                     |
| Who sees points      | Anyone who can read the topic - they already see every reaction count it is made of.                                                                                                                                      |
| Configuration        | None new. Points per reaction and who may react stay in AdminCP → Reactions and the role's **Reactions** tab.                                                                                                             |
| Core changes         | None. Everything lives in the forum plugin; core already exposes the tables, `ReactionBar` and live counts.                                                                                                              |

## API

### Shared helper

`plugins/forum/src/api/modules/forum/lib/reaction-points.ts`

- `reactionPointsSubquery(db, targetType)` - `{ targetId, points }` grouped per
  target, `pluginId = manifest.id`, joined with `core_reactions`, filtered on
  `targetAuthorId is not null`. Used by the feed ranking (topics) and the thread
  (comments). Served by `core_reactions_entries_target_idx`.
- `loadReactionPoints(c, targetType, ids)` - points for one page of ids, for
  routes that don't rank.

### Feed (`lib/feed.ts`)

Swap the `core_reactions_counts` join for `reactionPointsSubquery`. The response
field `score` is renamed `points`. Ranking cache key version goes to `2` so no
old entry is read back.

### Topic points

`GET /forum/stats/topics` (exists, cached per id set) gains `points` next to
`commentCount`, so the topic page and any list get them in the request they
already make. Its cache stays on the stats generation **plus** the one-minute
bucket the feed uses, since reactions don't move the generation.

### Comment points and sorting

`GET /forum/topics/{id}/comments/points?ids=…` → `{ id, points }[]` for the
comments on screen, `private` only when access rules apply (same headers helper
as the stats routes).

Sorting by points ranks **root comments** only; replies stay in order under
their parent so a conversation reads top to bottom. The thread is read through
the Content Engine (`content/server/thread.ts`), which pages roots by
`createdAt asc`. Two options:

1. **Plugin-side (proposed first):** for `?comments=points`, the forum asks
   for the ranked root ids (`reactionPointsSubquery` over `forum_comments`
   where `parent is null`), then reads those roots and their replies through
   the thread service by ids. No core change; pages are numbered, not cursors.
2. **Core option (later, if blog wants it too):** a `sort` on `thread` reads in
   the Content Engine, with the sort key in the cursor.

## UI

- **Feed card** (`topic-feed.tsx`):
  - `ReactionBar` in the card footer, so members react straight from the feed.
    Bars on one page share a single `GET /reactions?ids=…` (core batches per
    type), and counts update live over the WebSocket.
  - A **points badge** before the reactions: `+12` / `-3` / `0`, tinted with the
    same tokens as the reputation badge (`--success` above zero, `--destructive`
    below, muted at zero), the sign always written so color isn't the only cue.
    `sr-only` text "12 points"; tooltip "Points from reactions".
  - The "N points" text and the arrow icon go away.
- **Topic page**: the same badge next to the topic's `ReactionBar`.
- **Comments**: the badge in each comment's action row, before `ReactionBar`.
- **Sort comments**: a small select above the thread - "Oldest first"
  (default), "Newest first", "Most points". In the URL as `?comments=new` /
  `?comments=points`; the default isn't written. Loading a new order keeps the
  current comments dimmed (`aria-busy`, `opacity-60`) until the new page lands.
- Live points: the badge recomputes from the live reaction counts the bar
  already receives (`count × points` of each reaction in the catalog, minus
  nothing - self reactions can't be told apart in the browser, so the live
  number may be off by the author's own reactions until the next load).
  Open question 2.

## Phases

| Phase | Scope                                                                                 | Done when                                                                                      |
| ----- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1     | `reaction-points.ts`, feed on real points, `score` → `points`                         | A topic with one `thanks` (+2) outranks one with a `like` (+1) in Top; `sad` adds nothing      |
| 2     | `ReactionBar` + points badge on feed cards, badge on the topic page                   | Reacting from the feed updates the bar live and the badge on the next load                     |
| 3     | Comment points route, badge on comments                                               | Each comment shows the points its author earned from it                                       |
| 4     | Sort comments (Oldest / Newest / Most points)                                         | `?comments=points` puts the most-thanked root comment first; replies keep their order          |
| 5     | Docs                                                                                  | `guides/forum.mdx` explains points, sorting and where to set reaction points                    |

Each phase ends with `pnpm lint:fix`, typecheck, the existing tests and a run
of the app with seeded reactions of different points.

## Docs

- `guides/forum.mdx`: "Sort the feed" says points come from reactions and links
  to AdminCP → Reactions; new "Sort comments" section.
- `content-engine/reactions` (or `dev/reactions`): one line that the forum uses
  reaction points for ranking, as an example of reading them.

## Tests (a separate session, after it works)

- Feed ranking on a postgres fixture: reaction points weigh in, self reactions
  don't, negative points sink a topic, `top` windows.
- Comment points route: hidden comments and unreadable forums answer nothing.
- Comment sort: roots by points, replies in order.
- Points badge: sign and the sr-only label (DOM output only).

## Open questions

1. **Hot**: keep comments in Hot's engagement (`points + comments`, proposed),
   or points only?
2. **Live badge**: accept that the live number may count the author's own
   reactions until reload (proposed), or show the badge only from the server?
3. **Default comment order**: Oldest first (proposed, classic forum), or Most
   points?
