// Prototype - variant 1: the shipped card, unchanged.
import { UserPreviewCard } from '@vitnode/core/components/user-preview-card'

import type { Variant } from './shared'

export const current: Variant = {
  name: 'Current',
  contentClassName: 'w-72 overflow-hidden p-0 sm:w-80',
  Content: ({ nameCode }) => <UserPreviewCard nameCode={nameCode} />,
}
