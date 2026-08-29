import { createFileRoute } from '@tanstack/react-router'
import { SecuritySettings } from '@vitnode/core/views/auth/settings/security/security'

import { loadSettingsPanel, settingsPanelHead } from '#/lib/settings/panel'
import { SettingsBreadcrumb } from '#/migration/settings-breadcrumb'

/**
 * `/settings/security` - the security panel.
 *
 * `SecuritySettings` is the same module the Next.js page renders and is currently
 * a heading and nothing else. Password changes, two-factor enrolment, passkeys
 * and a session log are not features VitNode has yet, and this stage migrates
 * what exists rather than what the URL suggests might one day live here.
 *
 * Anonymous, this URL answers `/login?returnTo=/settings/security` from
 * `_authenticated`'s `beforeLoad` - no check in this file, and none wanted.
 */
export const Route = createFileRoute('/_main/_authenticated/settings/security')(
  {
    component: SecuritySettings,
    loader: async ({ context }) => await loadSettingsPanel(context, 'security'),
    head: ({ loaderData }) => settingsPanelHead(loaderData),
    staticData: { breadcrumb: <SettingsBreadcrumb navKey="security" /> },
  },
)
