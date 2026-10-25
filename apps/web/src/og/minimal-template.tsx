import type { OgImageTemplateInput } from '@vitnode/core/og-image/server'

import { truncateOgText } from '@vitnode/core/og-image/server'

/**
 * A light, text-only card: the title centred on a white background, the site
 * name underneath. Registered as `minimal` in `vitnode.api.config.ts`.
 */
export const minimalOgImageTemplate = ({
  height,
  locale,
  siteName,
  theme,
  title,
  width,
}: OgImageTemplateInput) => (
  <div
    lang={locale}
    style={{
      alignItems: 'center',
      backgroundColor: '#ffffff',
      color: '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: theme.fontFamily,
      gap: 32,
      height,
      justifyContent: 'center',
      padding: 96,
      width,
    }}
  >
    <div
      style={{
        display: 'block',
        fontSize: 72,
        fontWeight: 700,
        lineClamp: 3,
        lineHeight: 1.1,
        textAlign: 'center',
      }}
    >
      {truncateOgText(title, 90)}
    </div>
    <div style={{ color: theme.accentColor, display: 'flex', fontSize: 32 }}>
      {siteName}
    </div>
  </div>
)
