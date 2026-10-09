import type {
  PersonalInformationFields,
  UserPersonalInformation,
  UserPersonalInformationField,
} from "@/lib/user-personal-information";

import { personalInformationChanges } from "@/lib/user-personal-information";

export interface ProfileSheetValues extends Partial<
  Record<UserPersonalInformationField, boolean | string>
> {
  timeZone: string;
}

export interface ProfileChanges {
  personal: null | Partial<UserPersonalInformation>;
  timeZone?: string;
}

export const profileChanges = ({
  canEdit,
  fields,
  initialTimeZone,
  user,
  values,
}: {
  canEdit: boolean;
  fields: PersonalInformationFields;
  initialTimeZone: string;
  user: UserPersonalInformation;
  values: ProfileSheetValues;
}): ProfileChanges => {
  const personal = canEdit
    ? Object.fromEntries(
        Object.entries(personalInformationChanges(values, fields)).filter(
          ([key, value]) =>
            user[key as keyof UserPersonalInformation] !== value,
        ),
      )
    : {};

  return {
    personal: Object.keys(personal).length > 0 ? personal : null,
    ...(values.timeZone === initialTimeZone
      ? {}
      : { timeZone: values.timeZone }),
  };
};
