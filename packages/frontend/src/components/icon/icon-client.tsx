'use client';

import { Loader2 } from 'lucide-react';
import dynamicIconImports from 'lucide-react/dynamicIconImports';
import dynamic from 'next/dynamic';
import React from 'react';

import { cn } from '../../helpers/classnames';

export const IconClient = React.memo(
  ({ name, className }: { className?: string; name: string }) => {
    if (/\p{Extended_Pictographic}/gu.test(name)) {
      return <span className={className}>{name}</span>;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const LucideIcon = dynamic(dynamicIconImports[name]);

    return (
      <React.Suspense
        fallback={<Loader2 className={cn('animate-spin', className)} />}
        key={name}
      >
        {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
        {/* @ts-expect-error */}
        <LucideIcon className={className} />
      </React.Suspense>
    );
  },
);

IconClient.displayName = 'IconLucide';
