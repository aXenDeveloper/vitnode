import { Label } from '@vitnode/core/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@vitnode/core/components/ui/select'
import React from 'react'

const GROUPS = [
  {
    label: 'Members',
    items: [
      { label: 'Newest first', value: 'newest' },
      { label: 'Most posts', value: 'posts' },
    ],
  },
  {
    label: 'Activity',
    items: [
      { label: 'Last seen', value: 'last-seen' },
      { label: 'Most reactions', value: 'reactions' },
    ],
  },
]

const ITEMS = GROUPS.flatMap((group) => group.items)

export default function SelectGroupsExample() {
  return (
    <div className="not-prose flex w-full flex-col gap-2">
      <Label id="select-groups-label">Sort members by</Label>
      <Select defaultValue="newest" items={ITEMS}>
        <SelectTrigger
          aria-labelledby="select-groups-label"
          className="w-full"
          size="sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {GROUPS.map((group, index) => (
            <React.Fragment key={group.label}>
              {index > 0 && <SelectSeparator />}
              <SelectGroup>
                <SelectLabel>{group.label}</SelectLabel>
                {group.items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </React.Fragment>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
