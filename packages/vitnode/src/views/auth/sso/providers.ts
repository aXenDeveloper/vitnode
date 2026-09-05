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

export const normalizeSSOProviders = (value: unknown): SSOProvider[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();

  return value.filter(isProvider).filter(provider => {
    if (seen.has(provider.id)) return false;
    seen.add(provider.id);

    return true;
  });
};
