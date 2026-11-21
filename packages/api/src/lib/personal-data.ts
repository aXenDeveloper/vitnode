import type { Context } from "hono";

import type { EnvVitNode } from "@/middlewares/global.middleware";

type Db = EnvVitNode["Variables"]["db"];

/** The transaction an account erasure runs in. */
export type PersonalDataTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * What a plugin hands back for one member's data export: JSON-serializable
 * values (`Date`s become ISO strings).
 */
export type PersonalDataExport = Record<string, unknown>;

/**
 * How a plugin takes part in GDPR requests: what it hands a member who asks
 * for a copy of their data (Art. 15 and 20), and how it forgets them when the
 * account is erased (Art. 17). Declare it with {@link definePersonalData} and
 * pass it as `personalData` to `buildApiPlugin`.
 */
export interface PersonalDataHandlers {
  /**
   * Removes or anonymizes everything the plugin stores about `userId`. Runs
   * server-side inside the erasure transaction, before core deletes the
   * account row - so foreign keys to `core_users` still resolve, and a throw
   * rolls the whole erasure back (it is retried on the next cron run).
   *
   * Write through `tx`, never `c.get("db")`. Content the member published may
   * stay when deleting it would break other members' threads; strip the
   * personal parts (author, IP, email) instead. Data a law obliges you to keep
   * (invoices) may stay as long as it is no longer linked to the member.
   *
   * Leave side effects outside the database (storage, search, third-party
   * APIs) to a `user.deleted` event listener, which runs after the commit.
   */
  erase?: (args: {
    c: Context<EnvVitNode>;
    tx: PersonalDataTx;
    userId: number;
  }) => Promise<void>;
  /**
   * Returns the plugin's data about `userId` for the member's own download.
   * Plain JSON only, and never secrets (password hashes, tokens, keys). Omit
   * it when the plugin stores nothing about members. Server-side.
   */
  export?: (args: {
    c: Context<EnvVitNode>;
    userId: number;
  }) => Promise<PersonalDataExport>;
}

/** {@link PersonalDataHandlers} tagged with the plugin that declared them. */
export interface RegisteredPersonalData extends PersonalDataHandlers {
  pluginId: string;
}

/**
 * Declares how a plugin exports and erases a member's data. Returns the
 * handlers unchanged; pass them as `personalData` to `buildApiPlugin`.
 * Server-only.
 *
 * @example
 * ```ts
 * import { definePersonalData } from "@vitnode/api/lib/personal-data";
 * import { eq } from "drizzle-orm";
 *
 * import { polls_votes } from "@/database/votes";
 *
 * export const pollsPersonalData = definePersonalData({
 *   export: async ({ c, userId }) => ({
 *     votes: await c
 *       .get("db")
 *       .select({ pollId: polls_votes.pollId, optionId: polls_votes.optionId })
 *       .from(polls_votes)
 *       .where(eq(polls_votes.userId, userId)),
 *   }),
 *   erase: async ({ tx, userId }) => {
 *     await tx
 *       .update(polls_votes)
 *       .set({ ipAddress: null, userId: null })
 *       .where(eq(polls_votes.userId, userId));
 *   },
 * });
 * ```
 */
export const definePersonalData = (
  handlers: PersonalDataHandlers,
): PersonalDataHandlers => handlers;

/**
 * Every plugin's handlers, core last: plugins erase their rows while the
 * account still exists, then core removes the account itself.
 */
export const collectPersonalData = (
  plugins: readonly { personalData?: PersonalDataHandlers; pluginId: string }[],
  corePluginId: string,
): RegisteredPersonalData[] => {
  const registered = plugins
    .filter(plugin => plugin.personalData)
    .map(plugin => ({ ...plugin.personalData, pluginId: plugin.pluginId }));

  return [
    ...registered.filter(entry => entry.pluginId !== corePluginId),
    ...registered.filter(entry => entry.pluginId === corePluginId),
  ];
};
