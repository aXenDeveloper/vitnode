import { emailAliases } from "./user-email-lookup";

export const ssoConfirmsEmail = ({
  accountEmail,
  emailVerified,
  providerEmail,
}: {
  accountEmail: string;
  emailVerified: boolean;
  providerEmail: string;
}): boolean =>
  !emailVerified && emailAliases(providerEmail).includes(accountEmail);
