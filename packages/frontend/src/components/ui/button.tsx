import { Slot } from '@radix-ui/react-slot';
import { cva, VariantProps } from 'class-variance-authority';
import { useTranslations } from 'next-intl';
import React from 'react';

import { cn } from '../../helpers/classnames';
import { Loader } from './loader';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium no-underline ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&>span]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-input bg-background text-accent-foreground hover:bg-accent',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'text-accent-foreground text-foreground hover:bg-accent',
        destructiveGhost: 'text-destructive hover:bg-accent',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8 text-base [&>svg]:size-5',
        icon: 'size-9 [&>svg]:size-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<VariantProps<typeof buttonVariants>, 'size'> {
  ariaLabel?: string;
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
  ref?: React.RefCallback<HTMLButtonElement>;
  size?: 'default' | 'lg' | 'sm';
}

interface IconButtonProps extends Omit<ButtonProps, 'size'> {
  ariaLabel: string;
  size: 'icon';
}

const Button = ({
  ariaLabel,
  asChild = false,
  className,
  loading,
  size,
  type = 'button',
  variant,
  loadingText,
  ...props
}: ButtonProps | IconButtonProps) => {
  const t = useTranslations('core.global');
  const Comp = asChild ? Slot : 'button';

  if (loading) {
    const text = loadingText ? loadingText : t('loading');

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
        aria-label={text}
        disabled
        type="button"
      >
        <Loader small />
        <span className="truncate">{size !== 'icon' && text}</span>
      </Comp>
    );
  }

  return (
    <Comp
      aria-label={ariaLabel}
      className={cn(buttonVariants({ variant, size, className }))}
      type={type}
      {...props}
    />
  );
};

export { Button, buttonVariants };
