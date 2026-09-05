import type { UserOption } from "@/components/form/fields/input-users";

import type { ContentOption } from "./field-component";

export const contentOptionToUser = (option: ContentOption): UserOption => ({
  avatarColor: option.avatarColor ?? "",
  id: Number(option.value),
  name: option.label,
  nameCode: option.nameCode ?? "",
});
