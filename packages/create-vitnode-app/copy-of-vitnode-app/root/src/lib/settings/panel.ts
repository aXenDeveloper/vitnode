import { createSettingsPanel } from '@vitnode/core/tanstack/settings'

import { vitNodeShellConfig } from '#/vitnode.shell.config'

/**
 * The settings panel loaders, bound to this app.
 *
 * One line of application, and everything else is
 * `@vitnode/core/tanstack/settings`: the namespace list, the query the strings
 * are warmed through, the two message keys a panel title is made of, and the
 * decision that a panel's `head` is a title and nothing else.
 *
 * What is left here is the only thing a package cannot answer - this site's own
 * name, which is what a tab title ends with.
 */
export const { loadSettingsPanel, settingsPanelHead } = createSettingsPanel({
  metadata: vitNodeShellConfig.metadata,
})
