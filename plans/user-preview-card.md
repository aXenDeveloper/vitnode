# User preview card

Status: implemented. Owner: core (`@vitnode/core`).

Hover (or keyboard-focus) a member's name or avatar and a small card shows who
they are: cover, avatar, name, `@nameCode` and group (primary role), without
leaving the page. A tap on touch screens still just follows the link.

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
  moving the pointer across a list does not flash cards.
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
| Online / last seen                      | Done            | Separate presence API, browser-only and keyed by viewer, so it never lands in the cached profile. Waits for the session like the profile page. |
| Secondary roles                         | Done            | First two, then "+N".                                                                                                                         |
| Post / comment counts                   | Needs API       | No count in the profile response. Add aggregated counts (cached) to the profile route first.                                                  |
| Follow / message buttons                | Not possible    | VitNode has no follow or private-message system yet.                                                                                          |
| Warnings badge for moderators           | Possible later  | `ProfileWarnings` exists but is staff-only and heavier; keep the public card cacheable and leave it to the profile page.                      |
| `@mention` previews in rich text        | Possible later  | The editor has no mention node yet; once it does, render mentions with `UserPreview`.                                                         |
| Preview on AdminCP tables               | Not planned     | Names there sit inside row links/buttons, and nested links are invalid.                                                                       |
| Long-press preview on touch             | Not planned     | Base UI preview cards are hover/focus only by design; the tap goes to the profile, which is the expected touch behaviour.                     |
