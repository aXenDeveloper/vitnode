'use client';

import { CONFIG } from '@/lib/config';
import { VitNodeConfig } from '@/vitnode.config';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import React from 'react';
import { scan } from 'react-scan';
import { Toaster } from 'sonner';

export const RootProvider = ({
  children,
  theme,
  toaster,
  config,
}: {
  children: React.ReactNode;
  config: VitNodeConfig;
  theme: Omit<
    React.ComponentProps<typeof ThemeProvider>,
    'attribute' | 'disableTransitionOnChange' | 'enableSystem'
  >;
  toaster?: React.ComponentProps<typeof Toaster>;
}) => {
  React.useEffect(() => {
    if (!config.debug || !CONFIG.node_development) return;

    scan({
      enabled: true,
    });
  }, [config.debug]);

  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            refetchOnMount: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        disableTransitionOnChange
        enableSystem
        {...theme}
      >
        {children}
        <Toaster closeButton {...toaster} />
      </ThemeProvider>
    </QueryClientProvider>
  );
};
