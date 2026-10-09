import type { SSOIconSource } from "./icon";

import { ssoBrandColor } from "./brand";
import { ssoIconSource } from "./icon";

export interface SSOProvider {
  brandColor?: string;
  icon?: SSOIconSource;
  id: string;
  name: string;
}

interface UnverifiedProvider {
  brandColor?: unknown;
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

const warnOnce = (key: string, message: string) => {
  if (process.env.NODE_ENV !== "development" || warned.has(key)) return;

  warned.add(key);
  // oxlint-disable-next-line no-console
  console.warn(message);
};

const isPresent = (value: unknown) => value !== null && value !== undefined;

const toProvider = ({
  brandColor,
  icon,
  id,
  name,
}: UnverifiedProvider): SSOProvider => {
  const source = ssoIconSource(icon);
  const color = ssoBrandColor(brandColor);

  if (!source && isPresent(icon)) {
    warnOnce(
      `${id}:icon`,
      `[vitnode] the SSO provider "${id}" sent an icon its button cannot render, so it renders without one. An icon has to be a single <svg> element carrying nothing executable - no <script>, <style>, event handlers - or a URL to an image.`,
    );
  }

  if (!color && isPresent(brandColor)) {
    warnOnce(
      `${id}:brandColor`,
      `[vitnode] the SSO provider "${id}" sent a brand color its button cannot use, so the button stays neutral. A brand color has to be a hex value such as "#5865F2".`,
    );
  }

  return {
    ...(color ? { brandColor: color } : {}),
    ...(source ? { icon: source } : {}),
    id,
    name,
  };
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
