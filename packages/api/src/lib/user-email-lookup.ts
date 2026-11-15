import { inArray } from "drizzle-orm";

import { core_users } from "@/database/users";
import {
  canonicalizeEmail,
  normalizeEmailAddress,
} from "@/lib/email-canonical";

export const emailAliases = (email: string): string[] => {
  const normalized = normalizeEmailAddress(email);
  const canonical = canonicalizeEmail(normalized);

  return canonical === normalized ? [normalized] : [normalized, canonical];
};

export const matchesEmail = (email: string) =>
  inArray(core_users.email, emailAliases(email));

export const pickAccountForEmail = <T extends { email: string }>(
  rows: T[],
  email: string,
): T | undefined => {
  const normalized = normalizeEmailAddress(email);

  return rows.find(row => row.email === normalized) ?? rows[0];
};
