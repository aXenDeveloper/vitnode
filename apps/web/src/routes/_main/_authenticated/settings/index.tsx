import { createFileRoute } from '@tanstack/react-router'
import { OverviewSettings } from '@vitnode/core/views/auth/settings/overview/overview'

import { loadSettingsPanel, settingsPanelHead } from '#/lib/settings/panel'

/**
 * `/settings` - the settings root, which renders the overview panel.
 *
 * **Not a redirect to `/settings/overview`**, and that is a product decision
 * rather than a shortcut. The shell shows the navigation *instead of* the panel
 * on a narrow screen, so a visitor who opens `/settings` on a phone is looking at
 * a menu; redirecting them straight to `/settings/overview` would skip the menu
 * entirely and leave the mobile back link as the only way to reach it. On a
 * desktop the two URLs look identical, which is exactly what the Next.js app does
 * today (`routes/main/settings/page.tsx` renders `OverviewSettings` too).
 *
 * So `/settings` is a real page, and the navigation marks *Overview* as current
 * on it through the `aliases` entry in `SETTINGS_NAV_ITEMS` - one rule, shared
 * with the Next.js app, rather than a redirect and an active-state special case
 * that could disagree.
 *
 * Nothing about that can loop: this route renders, it does not navigate.
 *
 * `staticData` is deliberately absent, so `breadcrumbOf` falls through to the
 * layout's single "Settings" crumb - which is what the Next.js
 * `@breadcrumb/settings/page.tsx` slot renders for this URL.
 */
export const Route = createFileRoute('/_main/_authenticated/settings/')({
  component: OverviewSettings,
  /**
   * `head` **must** be written after `loader`: `loaderData`'s type is inferred
   * from `loader` in the same object literal, and TypeScript reads a literal's
   * members in order - put `head` first and `loaderData` is `never`. Neither
   * error names the cause.
   */
  loader: async ({ context }) => await loadSettingsPanel(context, 'overview'),
  head: ({ loaderData }) => settingsPanelHead(loaderData),
})
