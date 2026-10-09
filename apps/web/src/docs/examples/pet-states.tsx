import {
  downloadPetPng,
  downloadPetSvg,
  getPetSvgMarkup,
} from '@vitnode/core/components/pet/export'
import { Pet, type PetState } from '@vitnode/core/components/pet/pet'
import { Button } from '@vitnode/core/components/ui/button'
import { ButtonGroup } from '@vitnode/core/components/ui/button-group'
import { CopyButton } from '@vitnode/core/components/ui/copy-button'
import { DownloadIcon } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

const STATES: { name: string; state: PetState; use: string }[] = [
  { name: 'Idle', state: 'idle', use: 'Default pose' },
  { name: 'Hello', state: 'hello', use: 'Onboarding, welcome screens' },
  { name: 'Coding', state: 'coding', use: 'Docs and developer pages' },
  { name: 'Coffee', state: 'coffee', use: 'Breaks, quiet days' },
  { name: 'Love', state: 'love', use: 'Thank-you screens' },
  { name: 'Music', state: 'music', use: 'Media and playlists' },
  { name: 'Sleeping', state: 'sleeping', use: 'Idle or maintenance mode' },
  { name: 'Thinking', state: 'thinking', use: 'Loading states' },
  { name: 'Celebrate', state: 'celebrate', use: 'Success, first publish' },
  { name: 'Searching', state: 'searching', use: 'Empty search results' },
  { name: 'Offline', state: 'offline', use: 'Lost connection' },
  { name: 'Oops', state: 'oops', use: '404 pages' },
  { name: 'Dizzy', state: 'dizzy', use: '500 errors' },
  { name: 'Building', state: 'building', use: 'Maintenance, coming soon' },
]

const PetCard = ({ name, state, use }: (typeof STATES)[number]) => {
  const stageRef = React.useRef<HTMLDivElement>(null)
  const fileName = `vitnode-pet-${state}`

  const petSvg = () => {
    const svg = stageRef.current?.querySelector('svg')
    if (!(svg instanceof SVGSVGElement))
      throw new Error('Pet is not rendered yet')

    return svg
  }

  const downloadPng = async () => {
    try {
      await downloadPetPng(petSvg(), fileName)
    } catch {
      toast.error('Download failed', {
        description: `Your browser could not turn ${name} into a PNG. Try the SVG instead.`,
      })
    }
  }

  return (
    <li className="bg-card text-card-foreground flex h-full flex-col items-center gap-4 rounded-xl border p-4">
      <div className="h-36 w-32" ref={stageRef}>
        <Pet className="size-full" state={state} />
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-sm font-semibold">{name}</span>
        <code className="text-muted-foreground text-xs">state="{state}"</code>
        <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {use}
        </span>
      </div>
      <ButtonGroup aria-label={`Export ${name}`} className="mt-auto">
        <CopyButton
          aria-label={`Copy ${name} as SVG`}
          content={() => getPetSvgMarkup(petSvg())}
          size="sm"
        >
          Copy
        </CopyButton>
        <Button
          aria-label={`Download ${name} as SVG`}
          onClick={() => downloadPetSvg(petSvg(), fileName)}
          size="sm"
          variant="outline"
        >
          <DownloadIcon data-icon="inline-start" />
          SVG
        </Button>
        <Button
          aria-label={`Download ${name} as PNG`}
          onClick={() => void downloadPng()}
          size="sm"
          variant="outline"
        >
          <DownloadIcon data-icon="inline-start" />
          PNG
        </Button>
      </ButtonGroup>
    </li>
  )
}

export default function PetStates() {
  return (
    <ul className="not-prose grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {STATES.map((item) => (
        <PetCard key={item.state} {...item} />
      ))}
    </ul>
  )
}
