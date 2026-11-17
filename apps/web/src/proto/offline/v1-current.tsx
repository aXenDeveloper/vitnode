import { useLogo } from '@vitnode/core/components/logo-context'
import { SiteOfflineContent } from '@vitnode/core/views/site-offline/site-offline-content'
import { LogInIcon } from 'lucide-react'

import type { VariantProps } from './harness'

export const CurrentVariant = ({
  message,
  now,
  opensAt,
  showCountdown,
}: VariantProps) => {
  const logo = useLogo()

  return (
    <main className="bg-background text-foreground flex min-h-dvh flex-col items-center justify-center">
      <SiteOfflineContent
        fetchedAt={now}
        footer={
          <a
            className="text-muted-foreground inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline"
            href="/login"
          >
            <LogInIcon aria-hidden="true" className="size-4" />
            Staff sign in
          </a>
        }
        language="en"
        logo={logo}
        status={{
          message: [{ languageCode: 'en', value: message }],
          opensAt,
          serverNow: new Date(now).toISOString(),
          showCountdown: showCountdown && opensAt !== null,
        }}
      />
    </main>
  )
}
