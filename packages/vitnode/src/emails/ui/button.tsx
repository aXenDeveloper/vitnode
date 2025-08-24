import { Button as ButtonReactEmail } from '@react-email/components';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'cursor-pointer whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs',
        destructive: 'bg-destructive text-white shadow-xs',
        destructiveGhost: 'text-destructive',
        outline: 'border bg-background shadow-xs',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs',
        ghost: '',
        link: 'text-primary underline-offset-4',
      },
      size: {
        default: 'px-4 py-2',
        sm: 'rounded-md gap-1.5 px-3 py-1.5',
        lg: 'rounded-md px-6 py-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export const EmailButton = ({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ButtonReactEmail> &
  VariantProps<typeof buttonVariants>) => {
  return (
    <ButtonReactEmail
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
};
