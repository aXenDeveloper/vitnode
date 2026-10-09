import type { SSOIconSource } from "./icon";

import { ssoIconSource } from "./icon";

export interface SSOProvider {
  icon?: SSOIconSource;
  id: string;
  name: string;
}

interface UnverifiedProvider {
  icon?: unknown;
  id: string;
  name: string;
}

const isProvider = (value: unknown): value is UnverifiedProvider =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { id?: unknown }).id === "string" &&
  typeof (value as { name?: unknown }).name === "string" &&
  (value as { id: string }).id !== "";

const warned = new Set<string>();

const warnAboutIcon = (providerId: string) => {
  if (process.env.NODE_ENV !== "development" || warned.has(providerId)) return;

  warned.add(providerId);
  // oxlint-disable-next-line no-console
  console.warn(
    `[vitnode] the SSO provider "${providerId}" sent an icon its button cannot render, so it renders without one. An icon has to be a single <svg> element carrying nothing executable - no <script>, <style>, event handlers - or a URL to an image.`,
  );
};

const toProvider = ({ icon, id, name }: UnverifiedProvider): SSOProvider => {
  const source = ssoIconSource(icon);

  if (!source && icon !== null && icon !== undefined) warnAboutIcon(id);

  return source ? { icon: source, id, name } : { id, name };
};

export const normalizeSSOProviders = (value: unknown): SSOProvider[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();

  return value.filter(isProvider).reduce<SSOProvider[]>((providers, entry) => {
    if (seen.has(entry.id)) return providers;
    seen.add(entry.id);
    providers.push(toProvider(entry));

    return providers;
  }, []);
};
