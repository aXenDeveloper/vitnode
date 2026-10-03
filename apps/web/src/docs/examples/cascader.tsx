import { Cascader } from '@vitnode/core/components/ui/cascader'
import { Label } from '@vitnode/core/components/ui/label'
import React from 'react'

import { locations } from './cascader-options'

export default function CascaderExample() {
  const [office, setOffice] = React.useState<null | string>('krakow')

  return (
    <div className="not-prose flex w-full flex-col gap-2">
      <Label id="cascader-office-label">Office</Label>
      <Cascader
        aria-labelledby="cascader-office-label"
        onValueChange={setOffice}
        options={locations}
        placeholder="Pick an office"
        searchable
        showClear
        value={office}
      />
      <p className="text-muted-foreground text-sm leading-relaxed">
        Selected value: <code>{office ?? 'nothing yet'}</code>
      </p>
    </div>
  )
}
