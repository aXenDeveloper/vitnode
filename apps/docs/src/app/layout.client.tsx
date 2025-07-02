'use client';

import { cn } from 'fumadocs-ui/utils/cn';
import { useParams } from 'next/navigation';

export function useMode(): string | undefined {
  const { slug } = useParams();

  return Array.isArray(slug) && slug.length > 0 ? slug[0] : undefined;
}

export function Body({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const mode = useMode();

  return (
    <body className={cn(mode, 'flex min-h-screen flex-col')}>{children}</body>
  );
}
