import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  REGEXP_ONLY_DIGITS,
  REGEXP_ONLY_DIGITS_AND_CHARS,
} from '@vitnode/core/components/ui/input-otp'
import { Label } from '@vitnode/core/components/ui/label'
import React from 'react'

const Slots = ({ groups }: { groups: number[] }) =>
  groups.map((size, groupIndex) => {
    const start = groups.slice(0, groupIndex).reduce((sum, n) => sum + n, 0)

    return (
      <React.Fragment key={start}>
        {groupIndex > 0 && <InputOTPSeparator />}
        <InputOTPGroup>
          {Array.from({ length: size }, (_, slot) => (
            <InputOTPSlot index={start + slot} key={start + slot} />
          ))}
        </InputOTPGroup>
      </React.Fragment>
    )
  })

export default function InputOTPGroupsExample() {
  const pinId = React.useId()
  const backupId = React.useId()
  const [pin, setPin] = React.useState('')

  return (
    <div className="not-prose flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor={pinId}>PIN</Label>
        <InputOTP
          id={pinId}
          maxLength={4}
          onChange={setPin}
          pattern={REGEXP_ONLY_DIGITS}
          value={pin}
        >
          <Slots groups={[4]} />
        </InputOTP>
        <p
          aria-live="polite"
          className="text-muted-foreground text-sm leading-relaxed"
        >
          {pin.length === 4 ? 'PIN set. Nice and secret.' : 'Digits only.'}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={backupId}>Backup code</Label>
        <InputOTP
          id={backupId}
          maxLength={6}
          pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
        >
          <Slots groups={[2, 2, 2]} />
        </InputOTP>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Letters and digits.
        </p>
      </div>
    </div>
  )
}
