import { Button } from '@vitnode/core/components/ui/button'
import { DynamicIcon } from '@vitnode/core/components/ui/dynamic-icon'
import { loadLucideIcon } from '@vitnode/core/components/ui/icon-registry'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@vitnode/core/components/ui/input-group'
import { Skeleton } from '@vitnode/core/components/ui/skeleton'
import { SearchIcon } from 'lucide-react'
import React from 'react'

const SUGGESTIONS = [
  'rocket',
  'shield-check',
  'party-popper',
  'coffee',
] as const

const useIconExists = (name: string) => {
  const [result, setResult] = React.useState<{
    exists: boolean
    name: string
  }>()

  React.useEffect(() => {
    let isCurrent = true

    void loadLucideIcon(name).then((icon) => {
      if (isCurrent) setResult({ exists: icon !== undefined, name })
    })

    return () => {
      isCurrent = false
    }
  }, [name])

  return result?.name === name ? result.exists : undefined
}

export default function IconsDynamic() {
  const [query, setQuery] = React.useState('rocket')
  const name = query.trim().toLowerCase()
  const exists = useIconExists(name)

  return (
    <div className="not-prose flex w-full max-w-sm flex-col items-center gap-4">
      <div className="bg-card text-foreground flex size-24 items-center justify-center rounded-xl border">
        {name && exists !== false ? (
          <DynamicIcon
            className="size-10"
            fallback={<Skeleton className="size-10 rounded-md" />}
            name={name}
          />
        ) : (
          <span className="text-muted-foreground text-3xl">?</span>
        )}
      </div>
      <p
        aria-live="polite"
        className="text-muted-foreground min-h-5 text-center font-mono text-xs"
      >
        {exists === false ? `No icon called "${name}"` : `name="${name}"`}
      </p>
      <InputGroup>
        <InputGroupInput
          aria-label="Lucide icon name"
          autoCapitalize="none"
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type a lucide name..."
          spellCheck={false}
          value={query}
        />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion}
            onClick={() => setQuery(suggestion)}
            size="sm"
            variant="outline"
          >
            <DynamicIcon name={suggestion} />
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  )
}
