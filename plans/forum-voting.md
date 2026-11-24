# Votes (up/down) and ranked threads

Status: planned, not started. Owner: core (`@vitnode/api` + `@vitnode/core`),
first consumer `@vitnode/forum`.

The forum feed (`GET /forum/feed`, Hot/New/Active/Top) ranks topics by
**points**, and today points are borrowed from reactions: every reaction is
`+1`, a negative-point reaction is `-1`. That was a stand-in. Reactions say how
someone _feels_ ("haha", "thanks"); a vote says whether something _belongs
higher up_. This plan adds votes as their own core feature and switches the
forum's ranking to them.

## Goals

1. **Reddit-style voting** on anything: ▲ / ▼, one vote per member per item,
   click again to take it back, switch in one click.
2. **Opt in with one line**: `votes: true` on `defineContentType`, the same way
   `reactions: true` and `reports: true` work. Custom targets register with
   `defineVoteTarget`, like `defineReactionTarget`.
3. **Ranking source.** The forum feed, and later any "top" list, sorts by the
   vote score instead of reactions.
4. **Ranked comments.** Thread roots sort by Best (default), Top, New, Old or
   Controversial.
5. **Karma.** Votes feed the author's reputation, with weights an admin sets.
6. **Live.** Scores update on screen over the WebSocket when it's available,
   plain HTTP otherwise - the same as reactions.

Non-goals (first version): vote fuzzing, public lists of who voted, awards,
voting on AdminCP-only records, per-forum karma leaderboards.

## Votes and reactions side by side

Both stay. They answer different questions and read differently on screen.

|                | Reactions                         | Votes                                    |
| -------------- | --------------------------------- | ---------------------------------------- |
| Meaning        | Emotion, thanks                   | "Show this higher / lower"               |
| Per user       | Role cap, several kinds           | Exactly one: `+1`, `-1` or none          |
| Shown          | Pills with counts, who reacted    | Net score only, voters private           |
| Ranking        | No (after this plan)              | Yes - feed, Top, Best comments           |
| Reputation     | Per-reaction points               | Per-vote weights (default `+1` / `-1`)   |

After phase 3 the forum's points are **votes only**. Reactions remain on topics
and comments for emotion and no longer move the ranking. (Open question 1.)

## The pattern we copy: reactions

| Reactions                                                  | Votes                                                       |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| `defineReactionTarget` in `lib/reactions/targets.ts`       | `defineVoteTarget` in `lib/votes/targets.ts`                 |
| `reactions: true` → `contentReactionTarget(model)`         | `votes: true` → `contentVoteTarget(model)`                   |
| `resolveReactions` in `content/define-reactions.ts`        | `resolveVotes` in `content/define-votes.ts`                  |
| `core_reactions_entries` / `core_reactions_counts`         | `core_votes_entries` / `core_votes_counts`                   |
| `canReact` in `ContentViewerPermissions`                   | `canVote`, `canDownvote` next to it                          |
| `<ReactionBar target />`                                    | `<VoteControl target />`                                     |
| WebSocket channel `reactions/live`                         | `votes/live` (same room per target, same `seq` rule)         |
| Role tab **Reactions**                                     | Role tab **Votes**                                           |
| Events `reaction.added/removed/changed`                    | `vote.added`, `vote.removed`, `vote.changed`                 |

A target is the same triple `{ pluginId, type, id }`.

## Decisions

| Topic                | Decision                                                                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Values               | `1` or `-1`, stored; "no vote" is no row. `PUT` with `0` deletes.                                                                                                                                               |
| Own content          | Never. No self-votes, no automatic author upvote: every score starts at `0`.                                                                                                                                    |
| Who votes            | Role column `allowVote` (default `true`, `false` for guests). Downvoting is a separate `allowDownvote` (default `true`), so an install can keep fresh members to upvotes only. Most generous role wins.        |
| Daily limit          | Role column `votesPerDay` (`null` = unlimited, the default). Votes given today that still exist count, as with reactions. Toggle spam is the per-minute rate limit's job.                                     |
| Public numbers       | Net score only (`score = up - down`). Up and down counts stay on the server for ranking (Controversial, Best) and for moderators.                                                                               |
| Voter privacy        | Nobody sees who voted, except moderators with a new `can_view_votes` permission in ModCP (abuse checks). No timeline entries.                                                                                   |
| Reputation           | Two settings in **AdminCP → Votes**: points per upvote (default `1`) and per downvote (default `-1`), `-10..10`, `0` turns it off. Changing them queues a recount, like reaction points. Target opt-out `votes: { reputation: false }`. |
| Hidden / locked      | Unreadable or hidden targets can't be voted on; scores are kept and come back on unhide.                                                                                                                         |
| Deleted target/user  | Same as reactions: target deletion effects remove votes and their reputation; a deleted user cascades and a task recounts the targets and authors.                                                             |
| Concurrency          | One write path in a transaction with an advisory lock per target, like reactions, so `seq` follows commit order and counts never drift.                                                                        |
| Per-forum switch     | A container policy `votes: "updown" \| "up" \| "off"` (default `updown`, inherits from the parent forum), next to `publish` and `edits`. "Ask the experts" forums can go up-only; announcements can turn it off. |

## Data model

`packages/api/src/database/votes.ts`

```ts
/** One member's vote on one target. */
export const core_votes_entries = camelCase.table.withRLS(
  "core_votes_entries",
  t => ({
    pluginId: t.varchar({ length: 100 }).notNull(),
    targetType: t.varchar({ length: 100 }).notNull(),
    targetId: t.varchar({ length: CONTENT_ID_KEY_LENGTH }).notNull(),
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    value: t.smallint().notNull(), // 1 | -1
    // Who collects the reputation; null with `reputation: false`.
    targetAuthorId: t
      .integer()
      .references(() => core_users.id, { onDelete: "set null" }),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    primaryKey({
      columns: [t.pluginId, t.targetType, t.targetId, t.userId],
    }),
    index("core_votes_entries_user_day_idx").on(t.userId, t.createdAt),
    index("core_votes_entries_author_idx").on(t.targetAuthorId),
    check("core_votes_entries_value", sql`${t.value} in (-1, 1)`),
  ],
);

/** Denormalized totals, written in the same transaction as the entry. */
export const core_votes_counts = camelCase.table.withRLS(
  "core_votes_counts",
  t => ({
    pluginId: t.varchar({ length: 100 }).notNull(),
    targetType: t.varchar({ length: 100 }).notNull(),
    targetId: t.varchar({ length: CONTENT_ID_KEY_LENGTH }).notNull(),
    upvotes: t.integer().notNull().default(0),
    downvotes: t.integer().notNull().default(0),
    score: t.integer().notNull().default(0), // upvotes - downvotes
    version: t.bigint({ mode: "number" }).notNull().default(0),
  }),
  t => [
    primaryKey({ columns: [t.pluginId, t.targetType, t.targetId] }),
    // "Top" without scanning every target of a type.
    index("core_votes_counts_score_idx").on(t.pluginId, t.targetType, t.score),
  ],
);
```

Role columns (`core_roles`): `allowVote`, `allowDownvote`, `votesPerDay`.
Settings (`core_site` or the existing settings store): `votes.upvotePoints`,
`votes.downvotePoints`. Migration: guest role gets `allowVote = false`.

## API (core module `votes`)

| Route                                   | What                                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `PUT /votes`                            | `{ target, value: 1 \| -1 \| 0 }` → new public summary. `401` guest, `403` role/policy/own content, `404` unreadable target, `429` daily limit. |
| `GET /votes/summaries?pluginId&type&ids` | Public `{ id, score, seq }[]` for up to 100 ids. Cacheable; unreadable ids answer as score `0`.     |
| `GET /votes/me?pluginId&type&ids`       | The viewer's own `{ id, value }[]`, `private, no-store` - asked in the browser, like `/permissions`. |
| `GET /admin/votes/settings`, `PUT`      | Reputation weights. Staff permission.                                                              |
| `GET /moderation/votes/{target}`        | Voters of one target for moderators with `can_view_votes`.                                          |

Every write emits `vote.added` / `vote.changed` / `vote.removed` and, when
reputation moves, the existing `reputation.changed`. Documented in
`apps/web/content/docs/dev/events/built-in-events.mdx`.

## UI (`@vitnode/core/components/votes`)

- `<VoteControl target orientation="vertical" | "horizontal" />`: ▲ score ▼.
  Buttons with `aria-pressed` and labels ("Upvote", "Remove upvote"…), score
  in `ShortNumber` with a polite live region. Optimistic update, rolled back
  with a `sonner` toast on error; `isLoading` on the pressed button while
  sending. Disabled ▼ with a tooltip when the role or forum is up-only.
- Guests see the score; a click opens the sign-in prompt.
- Own content: score shown, buttons disabled with "You can't vote on your own post".
- Colors from tokens only (`text-primary` up, `text-destructive` down), the
  direction also given by the icon fill, never color alone.
- Batched reads: one `summaries` + one `me` request per page, shared through
  TanStack Query keys per target type, like reaction summaries.

## Forum changes

1. `votes: true` on `forum.topic` and `forum.comment`.
2. **Feed ranking** (`plugins/forum/src/api/modules/forum/lib/feed.ts`):
   points = `core_votes_counts.score` instead of the reactions join.
   - Hot: `sign(s) * log10(max(|s|, 1)) + epoch / 45000` with `s = score`
     (comments no longer inflate it - a flame war is not "hot" by itself).
   - Top: `score`, then `upvotes`.
   - New sort **Controversial**: `(up + down) ^ (min(up, down) / max(up, down))`
     for items with both, like Reddit.
   - The ranking cache keeps its one-minute bucket; a vote moves a score within
     a minute, which is fine for a feed.
3. **Feed card**: `VoteControl` vertical on the left from `md`, horizontal in
   the footer on phones; the "points" text goes away.
4. **Topic page**: `VoteControl` next to the title.
5. **Comments**: `VoteControl` in each comment's action row.

## Comment sorting (Content Engine `thread`)

Today thread roots are paged by `createdAt asc`
(`packages/api/src/content/server/thread.ts`). Add a `sort` to the thread
read: `best` (default when the type has votes), `top`, `new`, `old`,
`controversial`.

- **Best** is the Wilson score lower bound (95%) of `up / (up + down)`, so one
  lone upvote doesn't beat 40 up and 2 down. A pure function
  `wilsonLowerBound(up, down)` in `@vitnode/api/lib/votes/rank.ts`, mirrored in
  SQL for ordering.
- Only **roots** are reordered and paged; replies keep chronological order
  under their parent (readable conversations), as Reddit does for deep levels.
- The cursor encodes the sort key + id, so pages stay stable while scores move.
- The topic page gets a "Sort comments" select; the choice lives in the URL
  (`?comments=top`), the default isn't written.

## Phases

| Phase | Scope                                                                                                              | Done when                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 1     | Tables, migration, `lib/votes` service (write, limits, reputation, deletion), targets registry, `votes: true` in the Content Engine, API routes, events | `PUT /votes` works for a forum topic from curl; reputation moves; deleting the topic cleans up    |
| 2     | Role **Votes** tab, AdminCP **Votes** settings Sheet, per-forum `votes` policy                                     | An up-only forum refuses `-1` with `403`; a role without votes sees disabled buttons              |
| 3     | `VoteControl`, live channel `votes/live`, forum feed on votes, feed card + topic page + comments                    | Two browsers see each other's votes live; the feed reorders within a minute                       |
| 4     | Thread `sort` (Best/Top/New/Old/Controversial), Controversial in the feed                                          | A 40↑/2↓ comment sits above a 1↑/0↓ one under Best                                                |
| 5     | ModCP voters list (`can_view_votes`), docs                                                                          | Docs pages below are live                                                                          |

Each phase ends with `pnpm lint:fix`, typecheck, the existing tests and a run of
the app with seeded data.

## Docs

- `content-engine/votes.mdx`: `votes: true`, options, `canVote`, `VoteControl`.
- `dev/votes/*`: `defineVoteTarget` for custom targets, the API, the events.
- `guides/forum.mdx`: points are votes, the per-forum switch, comment sorting.
- `dev/events/built-in-events.mdx`: `vote.*`.

## Tests (a separate session, after it works)

- `lib/votes/rank.test.ts`: `wilsonLowerBound`, controversy - one `it.each`.
- Service: add/switch/remove, no self-vote, `allowDownvote`, daily limit,
  reputation deltas, concurrent writes keep counts exact (postgres test).
- `votes` routes: `401`/`403`/`404`/`429`, summaries hide unreadable targets.
- Content Engine: deletion effects remove votes (extend the reactions effects test).
- Forum feed: ordering per sort on a postgres fixture.
- `VoteControl`: pressed state, rollback on error, guest prompt.

## Open questions

1. **Reactions in the ranking.** Votes only (proposed), or keep reactions as a
   small bonus to Hot?
2. **Karma.** One reputation for reactions and votes (proposed), or a separate
   "karma" number next to it?
3. **Downvotes.** Everyone by default (proposed), or off until a role allows them?
4. **Default sort.** Hot for the home feed and Best for comments (proposed), or
   per forum (Active for support forums, like Invision)?
