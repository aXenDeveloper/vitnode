export type SSOIconComponent = React.ElementType<{ className?: string }>;

export type SSOIcon = React.ReactElement | SSOIconComponent;

const registered = new Map<string, SSOIcon>();

/**
 * Registers custom icons for SSO providers, keyed by provider id. A
 * registered icon wins over the one the provider's adapter sends; a component
 * is rendered with `className="size-4"`. Calls merge, so plugins can each add
 * their own. Call it from a module the router entry imports, so it runs before
 * the login screen renders.
 */
export const configureSSOIcons = (icons: Record<string, SSOIcon>) => {
  for (const [providerId, icon] of Object.entries(icons)) {
    registered.set(providerId, icon);
  }
};

export const ssoIcon = (providerId: string): SSOIcon | undefined =>
  registered.get(providerId);

export const resetSSOIcons = () => registered.clear();
