'use client';

import { cn } from '@/helpers/classnames';
import { OTPInput, OTPInputContext } from 'input-otp';
import { Dot } from 'lucide-react';
import React from 'react';

const InputOTP = ({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput>) => (
  <OTPInput
    className={cn('disabled:cursor-not-allowed', className)}
    containerClassName={cn(
      'flex items-center gap-2 has-[:disabled]:opacity-50',
      containerClassName,
    )}
    {...props}
  />
);

const InputOTPGroup = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div className={cn('flex items-center', className)} {...props} />
);

const InputOTPSlot = ({
  index,
  className,
  ...props
}: React.ComponentProps<'div'> & { index: number }) => {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index];

  return (
    <div
      className={cn(
        'border-input relative flex h-10 w-10 items-center justify-center border-y border-r text-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md',
        isActive && 'ring-ring ring-offset-background z-10 ring-2',
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      )}
    </div>
  );
};

const InputOTPSeparator = ({ ...props }: React.ComponentProps<'div'>) => (
  <div role="separator" {...props}>
    <Dot />
  </div>
);

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot };
