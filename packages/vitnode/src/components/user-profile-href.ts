/** The path of a user's public profile page. */
export const userProfileHref = (nameCode: string): string =>
  `/users/${encodeURIComponent(nameCode)}`;
