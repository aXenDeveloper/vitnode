import React from 'react';

import { cn } from '../../helpers/classnames';
import { Link } from '../../navigation';
import { Button } from './button';

export const Tabs = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <aside
      className={cn(
        'no-scrollbar shadow-border flex overflow-x-auto shadow-[inset_0_-2px_0]',
        className,
      )}
      {...props}
    >
      {children}
    </aside>
  );
};

export const TabsItem = ({
  active,
  children,
  className: classNameFromProps,
  href,
  ariaLabel,
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'asChild'> & {
  active?: boolean;
  children: React.ReactNode;
  className?: string;
  href?: string;
}) => {
  const dataState = active ? 'active' : 'inactive';

  const className = cn(
    'text-muted-foreground hover:text-foreground relative mb-2 flex-shrink-0',
    {
      'text-foreground': active,
    },
    classNameFromProps,
  );

  const underline = active && (
    <div className="bg-primary absolute -bottom-[8px] left-0 z-10 h-1 w-full rounded-md" />
  );

  if (href) {
    return (
      <Button
        ariaLabel={ariaLabel ?? ''}
        className={className}
        size="sm"
        variant="ghost"
        {...props}
        asChild
      >
        <Link className={className} data-state={dataState} href={href}>
          {children}
          {underline}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      ariaLabel={ariaLabel ?? ''}
      className={className}
      data-state={dataState}
      size="sm"
      variant="ghost"
      {...props}
    >
      {children}
      {underline}
    </Button>
  );
};
