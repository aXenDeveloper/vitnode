import { cn } from '@/helpers/classnames';
import { LucideIcon } from 'lucide-react';
import dynamicIconImports from 'lucide-react/dynamicIconImports';
import dynamic from 'next/dynamic';
import React from 'react';
import 'server-only';

interface Props extends Omit<LucideIcon, '$$typeof'> {
  className?: string;
  name: string;
}

export const Icon = ({ className, name, ...props }: Props) => {
  if (/\p{Extended_Pictographic}/gu.test(name)) {
    return (
      <span className={cn('text-center leading-none', className)}>{name}</span>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const LucideIcon = dynamic(dynamicIconImports[name]);

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  return <LucideIcon className={cn('text-center', className)} {...props} />;
};
