import { PROFILE_CONTENT_TAB } from "@/components/user-profile-href";

/** The profile's query string: which tab, and the Content tab's filter. */
export interface ProfileRouteSearch {
  tab?: typeof PROFILE_CONTENT_TAB;
  /** A content type id, e.g. `forum.comment`. Only read on the Content tab. */
  type?: string;
}

const CONTENT_TYPE_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9-]+)+$/;

/**
 * The route's `validateSearch`: it normalises rather than rejects. An unknown
 * tab is the Activity tab, and a malformed type is All. Whether a well-formed
 * type is still listed is the screen's call, once the profile says which are.
 */
export const normalizeProfileSearch = (
  input: Record<string, unknown>,
): ProfileRouteSearch => {
  if (input.tab !== PROFILE_CONTENT_TAB) return {};

  const type =
    typeof input.type === "string" &&
    input.type.length <= 64 &&
    CONTENT_TYPE_PATTERN.test(input.type)
      ? input.type
      : undefined;

  return type
    ? { tab: PROFILE_CONTENT_TAB, type }
    : { tab: PROFILE_CONTENT_TAB };
};
