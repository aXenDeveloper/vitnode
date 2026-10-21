import { defineOgImageTemplate } from '@vitnode/core/og-image'

/**
 * A dark, centered Open Graph template for announcements - the example of a
 * custom template registered in `vitnode.api.config.ts`. Satori draws it, so
 * it uses inline styles only.
 */
export const spotlightOgTemplate = defineOgImageTemplate({
  version: '1',
  render: ({ colors, description, logo, siteName, title }) => (
    <div
      style={{
        alignItems: 'center',
        background: '#0b1220',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
        height: '100%',
        justifyContent: 'center',
        padding: 80,
        textAlign: 'center',
        width: '100%',
      }}
    >
      {logo ? (
        <img
          alt=""
          height={88}
          src={logo.src}
          width={Math.round((logo.width / logo.height) * 88)}
        />
      ) : null}
      <div
        style={{
          display: 'block',
          fontSize: title.length > 60 ? 56 : 68,
          lineClamp: 3,
          lineHeight: 1.1,
        }}
      >
        {title}
      </div>
      {description ? (
        <div
          style={{
            color: '#cbd5e1',
            display: 'block',
            fontSize: 28,
            lineClamp: 2,
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      ) : null}
      <div style={{ color: colors.accent, display: 'flex', fontSize: 26 }}>
        {siteName}
      </div>
    </div>
  ),
})
