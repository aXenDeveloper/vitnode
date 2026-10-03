import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '@vitnode/core/components/ui/input-group'
import { Kbd } from '@vitnode/core/components/ui/kbd'
import { Copy, Search } from 'lucide-react'
import { toast } from 'sonner'

export default function InputGroupAddonsExample() {
  return (
    <div className="not-prose flex w-full flex-col gap-6">
      <InputGroup>
        <InputGroupInput
          aria-label="Search threads"
          placeholder="Search threads"
        />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          <Kbd>/</Kbd>
        </InputGroupAddon>
      </InputGroup>

      <InputGroup>
        <InputGroupInput
          aria-label="Community address"
          placeholder="night-owls"
        />
        <InputGroupAddon>
          <InputGroupText>https://</InputGroupText>
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          <InputGroupText>.vitnode.com</InputGroupText>
        </InputGroupAddon>
      </InputGroup>

      <InputGroup>
        <InputGroupInput
          aria-label="Invite link"
          defaultValue="https://vitnode.com/invite/k3x9"
          readOnly
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label="Copy invite link"
            onClick={() => {
              void navigator.clipboard.writeText(
                'https://vitnode.com/invite/k3x9',
              )
              toast.success('Invite link copied', {
                description: 'Paste it anywhere your friends hang out.',
              })
            }}
            size="icon-xs"
          >
            <Copy />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      <InputGroup>
        <InputGroupInput
          aria-label="Coupon code"
          disabled
          placeholder="Coupons are paused"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton disabled size="sm" variant="secondary">
            Apply
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
