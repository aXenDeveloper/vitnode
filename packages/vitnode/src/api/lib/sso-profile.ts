import { z } from "zod";

import type { SSOApiPlugin, SSOProviderUser } from "@/api/models/sso";
import type { SsoProfileValues } from "@/api/models/sso-connection-store";
import type { SsoProfileField } from "@/lib/sso-profile";

import { SSO_PROFILE_FIELDS } from "@/lib/sso-profile";
import {
  normalizePersonalField,
  USER_FIRST_NAME_MAX_LENGTH,
  USER_LAST_NAME_MAX_LENGTH,
} from "@/lib/user-personal-information";

const AVATAR_URL_MAX_LENGTH = 2048;

const zodAvatarUrl = z.url({ protocol: /^https$/ }).max(AVATAR_URL_MAX_LENGTH);

export const supportedProfileFields = (
  adapter: Pick<SSOApiPlugin, "profileFields">,
): SsoProfileField[] =>
  SSO_PROFILE_FIELDS.filter(field => adapter.profileFields?.includes(field));

const nameOf = (value: unknown, max: number): null | string => {
  const normalized = normalizePersonalField(value);

  return normalized && normalized.length <= max ? normalized : null;
};

export const normalizeSsoProfile = (
  adapter: Pick<SSOApiPlugin, "profileFields">,
  user: Pick<SSOProviderUser, "avatarUrl" | "firstName" | "lastName">,
): SsoProfileValues => {
  const supported = new Set(supportedProfileFields(adapter));
  const avatar = zodAvatarUrl.safeParse(user.avatarUrl);

  return {
    avatarUrl: supported.has("avatar") && avatar.success ? avatar.data : null,
    firstName: supported.has("firstName")
      ? nameOf(user.firstName, USER_FIRST_NAME_MAX_LENGTH)
      : null,
    lastName: supported.has("lastName")
      ? nameOf(user.lastName, USER_LAST_NAME_MAX_LENGTH)
      : null,
  };
};

export const PROFILE_VALUE_KEY: Record<
  SsoProfileField,
  keyof SsoProfileValues
> = {
  avatar: "avatarUrl",
  firstName: "firstName",
  lastName: "lastName",
};

export const restrictProfile = (
  profile: SsoProfileValues,
  fields: readonly SsoProfileField[],
): SsoProfileValues => ({
  avatarUrl: fields.includes("avatar") ? profile.avatarUrl : null,
  firstName: fields.includes("firstName") ? profile.firstName : null,
  lastName: fields.includes("lastName") ? profile.lastName : null,
});
