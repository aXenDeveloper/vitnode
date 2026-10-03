import { Avatar, AvatarFallback } from '@vitnode/core/components/ui/avatar'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@vitnode/core/components/ui/command'
import { Spinner } from '@vitnode/core/components/ui/spinner'
import React from 'react'
import { toast } from 'sonner'

const members = [
  { id: '1', name: 'Maya Chen', handle: 'maya' },
  { id: '2', name: 'Tom Becker', handle: 'tomb' },
  { id: '3', name: 'Aisha Khan', handle: 'aisha' },
  { id: '4', name: 'Lucas Silva', handle: 'lucas' },
  { id: '5', name: 'Nora Lindqvist', handle: 'nora' },
  { id: '6', name: 'Kenji Watanabe', handle: 'kenji' },
]

type Member = (typeof members)[number]

const searchMembers = async (query: string) =>
  new Promise<Member[]>((resolve) => {
    setTimeout(() => {
      const needle = query.trim().toLowerCase()
      resolve(
        members.filter(
          ({ handle, name }) =>
            name.toLowerCase().includes(needle) || handle.includes(needle),
        ),
      )
    }, 600)
  })

export default function CommandAsyncExample() {
  const [search, setSearch] = React.useState('')
  const [results, setResults] = React.useState<Member[]>(members)
  const [isLoading, setIsLoading] = React.useState(false)

  const latestRequestRef = React.useRef(0)

  const handleSearch = (query: string) => {
    setSearch(query)
    setIsLoading(true)
    latestRequestRef.current += 1
    const requestId = latestRequestRef.current

    void searchMembers(query).then((found) => {
      if (requestId !== latestRequestRef.current) return
      setResults(found)
      setIsLoading(false)
    })
  }

  return (
    <Command
      className="not-prose w-full rounded-xl border shadow-md"
      label="Search members"
      shouldFilter={false}
    >
      <CommandInput
        onValueChange={handleSearch}
        placeholder="Search members..."
        value={search}
      />
      <CommandList aria-busy={isLoading}>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm">
            <Spinner />
            Searching...
          </div>
        ) : (
          <>
            <CommandEmpty>No members match “{search}”.</CommandEmpty>
            <CommandGroup heading="Members">
              {results.map((member) => (
                <CommandItem
                  key={member.id}
                  onSelect={() =>
                    toast(`Opened @${member.handle}`, {
                      description: member.name,
                    })
                  }
                  value={member.id}
                >
                  <Avatar size="sm">
                    <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span>{member.name}</span>
                  <span className="text-muted-foreground ms-auto text-xs">
                    @{member.handle}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  )
}
