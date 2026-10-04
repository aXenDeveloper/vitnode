import { Cascader } from '@vitnode/core/components/ui/cascader'
import { Label } from '@vitnode/core/components/ui/label'

import { locations } from './cascader-options'

export default function CascaderColumnsExample() {
  return (
    <div className="not-prose flex w-full flex-col gap-2">
      <Label id="cascader-columns-label">Ship to</Label>
      <Cascader
        aria-labelledby="cascader-columns-label"
        expandTrigger="hover"
        layout="columns"
        options={locations}
        placeholder="Pick a city"
      />
    </div>
  )
}
