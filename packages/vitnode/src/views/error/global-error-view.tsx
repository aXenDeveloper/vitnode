import type { Metadata } from "next/dist/types";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import { LogoVitNode } from "@/components/logo-vitnode";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Error 500!",
};

export const GlobalErrorView = ({ className }: { className?: string }) => {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={className}>
        <ThemeProvider attribute="class" disableTransitionOnChange enableSystem>
          <div className="bg-background flex min-h-screen flex-col items-center justify-center p-4">
            <div className="container mx-auto flex w-full max-w-md flex-col items-center justify-center gap-6 text-center">
              <Link href="/">
                <LogoVitNode className="mb-4 h-12 w-auto" />
              </Link>

              <h1 className="text-3xl font-semibold tracking-tight">
                Oops! Something went wrong.
              </h1>

              <Card className="w-full">
                <CardContent>
                  <p className="text-muted-foreground">
                    An unexpected error occurred. Please try refreshing the page
                    or come back later.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
};
