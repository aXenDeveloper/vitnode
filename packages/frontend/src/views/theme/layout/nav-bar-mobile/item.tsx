'use client';

import { cn } from '@/helpers/classnames';
import { Link } from '@/navigation';

export const ItemNavBarMobile = ({
  href,
  className,
  children,
  title,
  onClick,
  ...props
}: React.HTMLAttributes<HTMLAnchorElement | HTMLButtonElement> & {
  children: React.ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
  title: string;
}) => {
  const classNameInternal = cn(
    '[&>span]:text-muted-foreground text-foreground flex flex-1 flex-col items-center justify-center gap-1.5 truncate px-2 text-center text-xs leading-none no-underline [&>svg]:size-6',
  );

  if (href) {
    return (
      <Link
        className={cn(classNameInternal, className)}
        href={href}
        onClick={onClick}
        {...props}
      >
        {children}
        <span className="w-full truncate">{title}</span>
      </Link>
    );
  }

  return (
    <button
      className={cn(classNameInternal, className)}
      onClick={onClick}
      type="button"
      {...props}
    >
      {children}
      <span className="w-full truncate">{title}</span>
    </button>
  );
};
