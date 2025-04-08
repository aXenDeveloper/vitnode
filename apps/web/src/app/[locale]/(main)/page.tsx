import { ArrowRight, Book, Terminal } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { LogoVitNode } from 'vitnode/components/logo-vitnode';
import { Button } from 'vitnode/components/ui/button';
import { Link } from 'vitnode/lib/navigation';

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'welcome.home' });

  return (
    <main className="container mx-auto flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-16 px-4 py-16">
      {/* Hero Section */}
      <div className="flex max-w-3xl flex-col items-center space-y-8 text-center">
        <LogoVitNode className="w-44" />

        <div className="space-y-4">
          <h1 className="from-foreground to-foreground/70 text-balance bg-gradient-to-br bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl lg:text-6xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-pretty text-lg">
            {t('desc')}
          </p>
        </div>

        {/* Primary Actions */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/admin" target="_blank">
              <Terminal className="mr-2 h-4 w-4" />
              {t('go_to_admin_cp')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          <Button asChild size="lg" variant="outline">
            <Link
              href="https://vitnode.com/docs"
              rel="noopener noreferrer"
              target="_blank"
            >
              <Book className="mr-2 h-4 w-4" />
              {t('read_our_docs')}
            </Link>
          </Button>

          <Button asChild size="lg" variant="ghost">
            <Link
              href="https://github.com/VitNode/vitnode"
              rel="noopener noreferrer"
              target="_blank"
            >
              <svg
                className="mr-2 h-4 w-4"
                role="img"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                  fill="currentColor"
                />
              </svg>
              View on GitHub
            </Link>
          </Button>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-card rounded-lg border p-6">
          <h3 className="mb-2 font-semibold">Plugin System</h3>
          <p className="text-muted-foreground text-sm">
            Create and install plugins to extend your application&apos;s
            functionality with ease.
          </p>
        </div>
        <div className="bg-card rounded-lg border p-6">
          <h3 className="mb-2 font-semibold">SSO Integration</h3>
          <p className="text-muted-foreground text-sm">
            Built-in support for Google, Facebook, and custom SSO providers.
          </p>
        </div>
        <div className="bg-card rounded-lg border p-6">
          <h3 className="mb-2 font-semibold">Modern Stack</h3>
          <p className="text-muted-foreground text-sm">
            Built with Next.js, TypeScript, and modern web technologies.
          </p>
        </div>
      </div>
    </main>
  );
}
