"use client";

import type { Metadata } from "next/dist/types";

import { HomeIcon, RefreshCwIcon } from "lucide-react";
// eslint-disable-next-line no-restricted-imports
import Link from "next/link";
import { useTransition } from "react";

import { LogoVitNode } from "@/components/logo-vitnode";
import { ThemeProvider } from "@/components/theme-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Error 500!",
};

export interface GlobalErrorViewProps {
  className?: string;
  error: Error & { digest?: string };
  retry: () => void;
}

export const GlobalErrorView = ({
  className,
  error,
  retry,
}: GlobalErrorViewProps) => {
  const [isRetrying, startRetry] = useTransition();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={className}>
        <ThemeProvider attribute="class" disableTransitionOnChange enableSystem>
          <div className="bg-background flex min-h-screen flex-col items-center justify-center p-4">
            <div className="container mx-auto flex w-full max-w-md flex-col items-center justify-center gap-6 text-center">
              <Link href="/">
                <LogoVitNode className="mb-4 h-12 w-auto" />
              </Link>

              <h1 className="text-3xl font-semibold tracking-tight text-balance">
                Oops! Something went wrong.
              </h1>

              <Card className="w-full">
                <CardContent className="flex flex-col gap-4">
                  <p className="text-muted-foreground leading-relaxed text-pretty">
                    An unexpected error occurred. Try again, and if it keeps
                    happening come back a little later.
                  </p>

                  {error.digest ? (
                    <p className="text-muted-foreground/70 font-mono text-xs">
                      Error reference: {error.digest}
                    </p>
                  ) : null}

                  <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Button
                      isLoading={isRetrying}
                      onClick={() => {
                        startRetry(() => {
                          retry();
                        });
                      }}
                      size="lg"
                    >
                      <RefreshCwIcon />
                      Try again
                    </Button>

                    <Link
                      className={cn(
                        buttonVariants({ size: "lg", variant: "ghost" }),
                      )}
                      href="/"
                    >
                      <HomeIcon />
                      Back to home
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
};
