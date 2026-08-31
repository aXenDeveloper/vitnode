import { createFileRoute } from '@tanstack/react-router'
import { OverviewSettings } from '@vitnode/core/tanstack/settings'

import { SettingsBreadcrumb } from '#/components/settings-breadcrumb'
import { loadSettingsPanel, settingsPanelHead } from '#/lib/settings/panel'

/**
 * `/settings/overview` - the overview panel at its own URL.
 *
 * The same component `/settings` renders, because the root is an alias of this
 * panel rather than a redirect to it (see `settings/index.tsx`). The two routes
 * differ in exactly one visible way, which is the breadcrumb: this one is two
 * crumbs deep.
 *
 * `OverviewSettings` is the same module the Next.js page renders and is currently
 * a heading and nothing else. Profile editing is not a feature VitNode has yet -
 * the route name is not a specification.
 */
export const Route = createFileRoute('/_main/_authenticated/settings/overview')(
  {
    component: OverviewSettings,
    loader: async ({ context }) => await loadSettingsPanel(context, 'overview'),
    head: ({ loaderData }) => settingsPanelHead(loaderData),
    staticData: { breadcrumb: <SettingsBreadcrumb navKey="overview" /> },
  },
)
