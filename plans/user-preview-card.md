# User preview card

Status: implemented. Owner: core (`@vitnode/core`).

Hover (or keyboard-focus) a member's name or avatar and a small card shows who
they are: cover, avatar, name, `@nameCode` and group (primary role), without
leaving the page. A tap on touch screens still just follows the link.

## Design - decided from /proto/user-preview

Four rounds: 4 directions, then 11, then 4 content riffs on the winning header,
then a refinement pass and the touch sheet.

- **Header (Ambient):** the cover sits behind the top of the card at 70% opacity
  and dissolves into it with an eased `mask-image` fade - no hard cover edge.
  Avatar 56px with a 4px translucent ring, then the name, `@nameCode`, and the
  **primary role only** on its own line below the handle.
- **Online status:** a dot on the avatar's bottom-right edge (green online, grey
  offline, none when hidden), with "Online now" / "Last seen ..." as its
  accessible label and tooltip. No status text line.
- **Stats:** three cells split by hairlines - Reputation (signed, short number,
  green/red), Joined and Last visited as short elapsed times ("7 yrs", "14 hr",
  "Online now").
- **Moderators:** a warnings row (active points, active/total count, Review link
  to `/modcp/warnings?user=<id>`), amber when there are active points. Only for
  `isModerator`; a `403` hides it; other failures show an inline retry.
- **One action:** a full-width "View profile" button.
- **Touch screens** (`(hover: none) and (pointer: coarse)`): a tap opens the
  same content in the swipeable bottom drawer instead of navigating. The cover
  runs to the sheet's top edge with the drag handle drawn over it.
- **Rejected:** the first card (cover strip, stacked meta - tall, roles wrapped
  to many lines); Compact (truncated group and headline); Immersive (identity on
  the photo - weak without a cover); Badge (centered, heavy, duplicate CTA);
  Split, ID card, Glass, Group, Details, Playful (each traded clarity for a
  look); secondary-role badges and a "Copy link" action (noise in a preview);
  Posts/Badges stats (no data in VitNode yet); "Find content" (search has no
  author filter in its URL); the Vaul package (Radix-based - the Base UI drawer
  already gives swipe-to-dismiss).

## Decisions

- **No data through props.** A trigger only knows the member's `nameCode` -
  the same key the link already needs. The card fetches everything else
  itself when it opens.
- **No new API.** `GET /users/profile/{nameCode}` already returns the avatar,
  cover, name, headline, roles, join date and reputation, and it is public and
  cacheable. The card reads it through `userProfileQueryOptions`, so it shares
  the cache with the profile page: hover a name, click it, and the profile
  renders from cache.
- **Fetch on open, not on render.** A page lists dozens of names; only the
  card someone actually opens sends a request. The card's code is a
  `React.lazy` chunk, preloaded on pointer enter, so `UserFormat` stays as
  light as before everywhere it renders.
- **Skeleton shaped like the card** (cover strip, avatar circle, two text
  lines, role pill) while the messages or the profile load. It has `aria-busy`
  and one sr-only `role="status"` label.
- **Errors use `Empty`**: `404` says the profile is gone (no retry), any other
  failure offers a retry that refetches in place.
- **Opens after 400 ms, closes after 150 ms**, like the reaction peek, so
  moving the pointer across a list does not flash cards. On touch screens a
  tap opens a bottom sheet instead.
- **No nested cards.** The name inside the card is a plain link, and the
  reaction peek (itself a hover card) turns previews off.

## API

- `UserPreview` (`@vitnode/core/components/user-preview`): a link to the
  profile that opens the card. `decorative` hides a duplicate link (an avatar
  next to a linked name) from the tab order and screen readers.
- `UserFormat` gets `preview` (default `true`), which only applies with
  `link`.

## Wired in

Every `UserFormat link` (comments, forum, blog, newsroom, search feed,
who-reacted, ModCP reports, activity logs), plus the avatars beside them in
core comments, the forum, blog comments and blog post bylines.

## Other things the card can show - checked

| Idea                                    | Status          | Notes                                                                                                                                         |
| --------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Headline                                | Done            | Already in the profile response; respects the personal-information setting.                                                                  |
| Member since                            | Done            | Already in the profile response.                                                                                                              |
| Reputation pill                         | Done            | Already in the profile response; reuses `Reputation`.                                                                                         |
| Online / last seen                      | Done            | Avatar dot + "Last visited" stat. Separate presence API, browser-only and keyed by viewer, so it never lands in the cached profile.           |
| Secondary roles                         | Dropped         | The card shows the primary role only; the profile page lists the rest.                                                                       |
| Post / comment counts                   | Needs API       | No count in the profile response. Add aggregated counts (cached) to the profile route first.                                                  |
| Follow / message buttons                | Not possible    | VitNode has no follow or private-message system yet.                                                                                          |
| Warnings for moderators                 | Done            | Read from `GET /moderation/members/{id}` in the browser only, so the public profile stays cacheable.                                         |
| `@mention` previews in rich text        | Possible later  | The editor has no mention node yet; once it does, render mentions with `UserPreview`.                                                         |
| Preview on AdminCP tables               | Not planned     | Names there sit inside row links/buttons, and nested links are invalid.                                                                       |
| Preview on touch                        | Done            | A tap opens the card in a bottom drawer; "View profile" navigates.                                                                           |
