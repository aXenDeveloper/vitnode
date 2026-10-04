/**
 * Message namespaces of the Notifications Center page. Their own module
 * because `routes.tsx` is read by the build in Node.
 */
export const NOTIFICATIONS_NAMESPACES = [
  "core.global",
  "core.notifications",
] as const;
