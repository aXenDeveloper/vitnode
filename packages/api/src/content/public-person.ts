import { z } from "zod";

/**
 * The public summary of a person named by `publicApi.people`, such as a
 * record's author. The field is `null` when the account was deleted. Render it
 * with `UserFormat` from `@vitnode/core/components/user-format` and `Avatar` from
 * `@vitnode/core/components/avatar`.
 */
export interface ContentPublicPerson {
  /** The background of the initials avatar shown without `avatarUrl`. */
  avatarColor: string;
  avatarUrl: null | string;
  /**
   * The first and last name, set only when the member turned on "Show my real
   * name" and the install allows it; `null` otherwise. `UserFormat` shows it
   * in place of `name`.
   */
  fullName?: null | string;
  /** The user id - compare it with the session's user to find the owner. */
  id: number;
  /** The nickname. */
  name: string;
  /** The profile URL segment: `/users/{nameCode}`. */
  nameCode: string;
  /** The role's name color and prefix icon, both optional. */
  role: { color: null | string; prefix: null | string };
}

/** Validates a {@link ContentPublicPerson}; add `.nullable()` for a person field. */

export const zodContentPublicPerson = z.object({
  avatarColor: z.string(),
  avatarUrl: z.string().nullable(),
  fullName: z.string().nullable().optional(),
  id: z.number(),
  name: z.string(),
  nameCode: z.string(),
  role: z.object({
    color: z.string().nullable(),
    prefix: z.string().nullable(),
  }),
});

/** Narrows an unknown value to a {@link ContentPublicPerson}. */
export const isContentPublicPerson = (
  value: unknown,
): value is ContentPublicPerson =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { id?: unknown }).id === "number" &&
  typeof (value as { nameCode?: unknown }).nameCode === "string";
