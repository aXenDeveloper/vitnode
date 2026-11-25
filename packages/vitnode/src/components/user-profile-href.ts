/** The path of a user's public profile page. */
export const userProfileHref = (nameCode: string): string =>
  `/users/${encodeURIComponent(nameCode)}`;

/** The query value that opens a profile's Content tab. */
export const PROFILE_CONTENT_TAB = "content";

/**
 * A profile's Content tab, optionally filtered to one content type:
 * `/users/maciej?tab=content&type=forum.comment`.
 */
export const userProfileContentHref = (
  nameCode: string,
  type?: null | string,
): string => {
  const search = new URLSearchParams({ tab: PROFILE_CONTENT_TAB });
  if (type) search.set("type", type);

  return `${userProfileHref(nameCode)}?${search.toString()}`;
};
