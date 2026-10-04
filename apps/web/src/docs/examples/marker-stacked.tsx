import {
  Marker,
  MarkerContent,
  MarkerIcon,
} from '@vitnode/core/components/ui/marker'
import { BookOpenCheck } from 'lucide-react'

export default function MarkerStackedExample() {
  return (
    <Marker className="not-prose flex-col" tone="success">
      <MarkerIcon>
        <BookOpenCheck />
      </MarkerIcon>
      <MarkerContent>Search index rebuilt</MarkerContent>
    </Marker>
  )
}
