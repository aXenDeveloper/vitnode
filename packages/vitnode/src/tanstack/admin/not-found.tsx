"use client";

import { NotFound } from "../layout/not-found";

/**
 * The AdminCP's 404 - the answer a screen this administrator may not open gets,
 * which {@link requireAdminPermission} produces with `notFound()`.
 *
 * ## Mount it inside the shell, not beside it
 *
 * The host puts this in the `notFoundComponent` of the route that guards the
 * AdminCP, and that route has to render its shell around it *here as well*. A
 * `notFoundComponent` renders instead of the component of the route that
 * handles the error, so the shell that route mounts is exactly what is missing
 * by the time this renders - and a refusal with no sidebar, no header and no
 * palette leaves an administrator on a dead page with the browser's back button
 * for a way out. The Next.js AdminCP keeps the panel: its `not-found.tsx` sits
 * under `admin/(auth)/layout.tsx`. `apps/web/src/routes/_admin.tsx` shows the
 * two lines that match it.
 *
 * This component deliberately does not mount the shell itself. It is the
 * message, and the shell needs a link component and a user lookup that only a
 * host can supply.
 *
 * ## It is `NotFound`, and the difference is where it is mounted
 *
 * The message is identical to the one the root route renders for a URL nothing
 * matched, so it is the same component rather than a second copy of the same
 * three lines - a 404 that read differently inside the AdminCP would be a
 * distinction without a reason. What is admin-specific is the *mounting* rule
 * above, which is the host route's, and the `actions` this is handed.
 */
export const AdminNotFound = ({ actions }: { actions?: React.ReactNode }) => (
  <NotFound actions={actions} />
);
