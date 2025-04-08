import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import { baseOptions } from '@/src/app/layout.config';
import { source } from '@/src/lib/source';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout {...baseOptions} tree={source.pageTree}>
      {children}
    </DocsLayout>
  );
}
