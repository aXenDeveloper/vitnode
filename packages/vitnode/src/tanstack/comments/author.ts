import type { ContentPublicPerson } from "@/content/public-person";

import { zodContentPublicPerson } from "@/content/public-person";

const zodAuthor = zodContentPublicPerson.nullable().catch(null);

/**
 * The comment's author from its public record's `author` field, or `null`
 * for a deleted account or a content type without one. Pure.
 */
export const contentCommentAuthor = (
  record: unknown,
): ContentPublicPerson | null =>
  typeof record === "object" && record !== null && "author" in record
    ? zodAuthor.parse(record.author)
    : null;

/** The name to show for a person, preferring a real name they share. Pure. */
export const contentCommentAuthorName = (
  person: ContentPublicPerson | null,
): null | string => (person ? (person.fullName ?? person.name) : null);
