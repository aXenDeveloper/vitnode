import { RouteMessages } from '@vitnode/core/tanstack/i18n'

export const StaticBreadcrumb = ({ label }: { label: string }) => (
  <RouteMessages>
    <span>{label}</span>
  </RouteMessages>
)
