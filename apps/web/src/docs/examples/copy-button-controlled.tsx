import { CopyButton } from '@vitnode/core/components/ui/copy-button'
import React from 'react'

const inviteLink = 'https://vitnode.com/invite/7Hq2'

export default function CopyButtonControlledExample() {
  const [copied, setCopied] = React.useState(false)

  return (
    <div className="not-prose flex w-full flex-col gap-3">
      <div className="bg-muted flex items-center gap-2 rounded-md border py-1 ps-3 pe-1">
        <code className="text-foreground min-w-0 flex-1 truncate font-mono text-sm">
          {inviteLink}
        </code>
        <CopyButton
          content={inviteLink}
          copied={copied}
          onCopiedChange={setCopied}
          size="sm"
          variant="secondary"
        >
          {copied ? 'Copied' : 'Copy link'}
        </CopyButton>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {copied
          ? 'Now paste it in #general and watch the members roll in.'
          : 'Share this link to invite people to your community.'}
      </p>
    </div>
  )
}
