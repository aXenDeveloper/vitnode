'use client';

import { MiddlewareContext } from '@/hooks/use-middleware-data';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import NextTopLoader from 'nextjs-toploader';
import React from 'react';
import { ShowMiddlewareObj } from 'vitnode-shared/middleware.dto';

import { Toaster } from '../../components/ui/sonner';

export const RootProviders = ({
  children,
  middlewareData,
}: {
  children: React.ReactNode;
  middlewareData?: ShowMiddlewareObj;
}) => {
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
      <NextTopLoader
        color="hsl(var(--primary))"
        height={4}
        showSpinner={false}
      />
      <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
        {middlewareData ? (
          <MiddlewareContext value={{ ...middlewareData }}>
            {children}
          </MiddlewareContext>
        ) : (
          children
        )}
        <Toaster closeButton />
      </NextThemesProvider>
    </QueryClientProvider>
  );
};
