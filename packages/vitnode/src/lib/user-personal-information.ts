export const USER_FIRST_NAME_MAX_LENGTH = 128;
export const USER_LAST_NAME_MAX_LENGTH = 128;
export const USER_HEADLINE_MAX_LENGTH = 100;
export const USER_PHONE_MAX_LENGTH = 32;

/** Digits and the punctuation international numbers are written with. */
export const USER_PHONE_PATTERN = /^[\d\s+()-]+$/;

export interface UserPersonalInformation {
  firstName: null | string;
  headline: null | string;
  lastName: null | string;
  phone: null | string;
  showRealName: boolean;
}

export const PERSONAL_INFORMATION_TEXT_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "headline",
] as const satisfies readonly (keyof UserPersonalInformation)[];

export const PERSONAL_INFORMATION_FIELDS = [
  ...PERSONAL_INFORMATION_TEXT_FIELDS,
  "showRealName",
] as const satisfies readonly (keyof UserPersonalInformation)[];

export type UserPersonalInformationTextField =
  (typeof PERSONAL_INFORMATION_TEXT_FIELDS)[number];

export type UserPersonalInformationField =
  (typeof PERSONAL_INFORMATION_FIELDS)[number];

export type PersonalInformationFields = Record<
  UserPersonalInformationField,
  boolean
>;

export type PersonalInformationFieldsConfig =
  Partial<PersonalInformationFields>;

export const resolvePersonalInformationFields = (
  config: PersonalInformationFieldsConfig = {},
): PersonalInformationFields =>
  Object.fromEntries(
    PERSONAL_INFORMATION_FIELDS.map(field => [field, config[field] !== false]),
  ) as PersonalInformationFields;

export const normalizePersonalField = (value: unknown): null | string => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

export const personalInformationChanges = (
  input: Partial<Record<UserPersonalInformationField, unknown>>,
  fields: PersonalInformationFields = resolvePersonalInformationFields(),
): Partial<UserPersonalInformation> => ({
  ...Object.fromEntries(
    PERSONAL_INFORMATION_TEXT_FIELDS.filter(
      field => fields[field] && field in input,
    ).map(field => [field, normalizePersonalField(input[field])]),
  ),
  ...(fields.showRealName && typeof input.showRealName === "boolean"
    ? { showRealName: input.showRealName }
    : {}),
});

export const fullNameOf = ({
  firstName,
  lastName,
}: Pick<UserPersonalInformation, "firstName" | "lastName">): null | string => {
  const parts = [firstName, lastName]
    .map(normalizePersonalField)
    .filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(" ") : null;
};

export const displayNameOf = ({
  firstName,
  lastName,
  name,
  showRealName,
}: Pick<UserPersonalInformation, "firstName" | "lastName" | "showRealName"> & {
  name: string;
}): string => {
  if (!showRealName) return name;

  return fullNameOf({ firstName, lastName }) ?? name;
};
