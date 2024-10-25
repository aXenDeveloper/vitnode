'use client';

import React from 'react';

import { cn } from '../../helpers/classnames';
import { Link, usePathname } from '../../navigation';
import { buttonVariants } from './button';

export const Tabs = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        'no-scrollbar shadow-border overflow-x-auto shadow-[inset_0_-2px_0]',
        className,
      )}
    >
      <div className="flex">{children}</div>
    </div>
  );
};

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  return <div className="relative pb-2">{children}</div>;
};

export interface TabsTriggerProps {
  active?: boolean;
  children: React.ReactNode;
  className?: string;
  href?: string;
  id: string;
  onClick?: () => void;
}

export const TabsTrigger = ({
  active: activeFromProps,
  children,
  className: classNameFromProps,
  href,
  onClick,
}: TabsTriggerProps) => {
  const pathname = usePathname();
  const active = activeFromProps ?? (href && pathname.includes(href));
  const dataState = active ? 'active' : 'inactive';

  const className = buttonVariants({
    variant: 'ghost',
    className: cn(
      classNameFromProps,
      'text-muted-foreground hover:text-foreground flex-shrink-0',
      {
        'text-foreground': active,
      },
    ),
    size: 'sm',
  });

  const underline = active && (
    <div className="bg-primary absolute bottom-0 left-0 z-10 h-1 w-full rounded-md" />
  );

  if (href) {
    return (
      <Wrapper>
        <Link
          className={className}
          data-state={dataState}
          href={href}
          onClick={onClick}
        >
          {children}
          {underline}
        </Link>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <button
        className={className}
        data-state={dataState}
        onClick={onClick}
        type="button"
      >
        {children}
        {underline}
      </button>
    </Wrapper>
  );
};
