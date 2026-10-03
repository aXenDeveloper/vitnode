import { Button } from '@vitnode/core/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@vitnode/core/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@vitnode/core/components/ui/input-group'
import { Search, SearchX } from 'lucide-react'
import React from 'react'

const integrations = [
  'Amazon S3',
  'Nodemailer',
  'PostgreSQL',
  'reCAPTCHA',
  'Redis',
]

export default function EmptySearchExample() {
  const [query, setQuery] = React.useState('xylophone')
  const trimmed = query.trim()
  const results = integrations.filter((integration) =>
    integration.toLowerCase().includes(trimmed.toLowerCase()),
  )

  return (
    <div className="not-prose flex w-full max-w-md flex-col gap-4">
      <InputGroup>
        <InputGroupInput
          aria-label="Search integrations"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search integrations..."
          value={query}
        />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
      </InputGroup>

      <p className="sr-only" role="status">
        {results.length === 1
          ? '1 integration'
          : `${results.length} integrations`}
      </p>

      {results.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-lg border">
          {results.map((integration) => (
            <li className="px-4 py-2 text-sm leading-relaxed" key={integration}>
              {integration}
            </li>
          ))}
        </ul>
      ) : (
        <Empty className="border p-6 md:p-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>No integrations found</EmptyTitle>
            <EmptyDescription>
              Nothing matches &ldquo;{trimmed}&rdquo;. Check the spelling or try
              a shorter search.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setQuery('')} size="sm" variant="outline">
              Clear search
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </div>
  )
}
