import { SETTINGS_ROW, SettingsGroup } from '@vitnode/core/views/auth/settings/settings-group'

import { formatPoints, type ProtoUsage } from './data'
import { DetailsLink } from './shared'

export const Current = ({ usage }: { usage: ProtoUsage }) => (
  <SettingsGroup title="AI points">
    <li className={SETTINGS_ROW}>
      <p className="text-sm leading-relaxed">
        <span className="font-medium">Unlimited points</span>{' '}
        <span className="text-muted-foreground tabular-nums">{formatPoints(usage.used)} points used this month</span>
      </p>
    </li>
    <li className={SETTINGS_ROW}>
      <DetailsLink />
    </li>
  </SettingsGroup>
)
