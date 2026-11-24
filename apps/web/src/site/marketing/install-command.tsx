import { cn } from 'cn'
import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export const INSTALL_COMMAND = 'npx create-vitnode-app@canary'

const COPIED_MS = 1500

export const InstallCommand = ({
  className,
  copiedLabel,
  copyLabel,
}: {
  className?: string
  copiedLabel: string
  copyLabel: string
}) => {
  const [isCopied, setIsCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
    },
    [],
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND)
    } catch {
      return
    }

    setIsCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setIsCopied(false)
    }, COPIED_MS)
  }

  return (
    <div
      className={cn(
        'bg-muted/60 flex h-11 w-fit max-w-full items-center gap-2 rounded-xl border pr-1 pl-4 font-mono text-sm',
        className,
      )}
    >
      <span aria-hidden className="text-muted-foreground select-none">
        $
      </span>
      <code className="truncate">{INSTALL_COMMAND}</code>
      <button
        aria-label={isCopied ? copiedLabel : copyLabel}
        className="mk-press text-muted-foreground hover:text-foreground hover:bg-background relative flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors before:absolute before:-inset-1"
        onClick={() => void handleCopy()}
        type="button"
      >
        {isCopied ? (
          <Check aria-hidden className="text-primary size-4" />
        ) : (
          <Copy aria-hidden className="size-4" />
        )}
      </button>
      <span aria-live="polite" className="sr-only">
        {isCopied ? copiedLabel : ''}
      </span>
    </div>
  )
}
