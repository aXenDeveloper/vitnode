/**
 * An SSO provider, as the auth screens need it: something to click and
 * something to call it.
 *
 * Ordinary typed data rather than a registry lookup. The list is deployment
 * configuration - it comes from the middleware route, which derives it from
 * `vitnode.api.config.ts` - so both frameworks fetch the same JSON and hand it
 * straight to the shared button row.
 */
export interface SSOProvider {
  id: string;
  name: string;
}

const isProvider = (value: unknown): value is SSOProvider =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { id?: unknown }).id === "string" &&
  typeof (value as { name?: unknown }).name === "string" &&
  (value as { id: string }).id !== "";

/**
 * The provider list, made safe to render.
 *
 * Every caller already holds a parsed API response, so this is not validation
 * so much as a single place for the three questions a button row would
 * otherwise ask inline: is there a list at all (a loader that has not resolved,
 * a deployment with no adapters), does each entry have the two fields a button
 * needs, and is any provider listed twice - which React answers with a
 * duplicate-key warning and a row that renders one button too many.
 *
 * Order is preserved: it is the order the adapters were registered in, which is
 * the order the deployment chose.
 */
export const normalizeSSOProviders = (value: unknown): SSOProvider[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();

  return value.filter(isProvider).filter(provider => {
    if (seen.has(provider.id)) return false;
    seen.add(provider.id);

    return true;
  });
};
