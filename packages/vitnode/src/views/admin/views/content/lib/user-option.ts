import type { UserOption } from "@/components/form/fields/input-users";

import type { ContentOption } from "./field-component";

/**
 * A picker option, as a person.
 *
 * The options route sends `avatarColor` and `nameCode` for a `user` field and
 * for nothing else, so this is where the generic `{ label, value }` an option
 * always is becomes the four things a face needs. Shared by the single people
 * picker and the to-many one, because a person who rendered differently in the
 * two would be the same person twice.
 */
export const contentOptionToUser = (option: ContentOption): UserOption => ({
  avatarColor: option.avatarColor ?? "",
  id: Number(option.value),
  name: option.label,
  nameCode: option.nameCode ?? "",
});
