import { useTranslations } from 'next-intl';
import { LogoVitNode } from 'vitnode-frontend/components/logo-vitnode';
import { Button } from 'vitnode-frontend/components/ui/button';
import { Link } from 'vitnode-frontend/navigation';

export default function DefaultPage() {
  const t = useTranslations('welcome.home');

  return (
    <main className="container flex max-w-5xl flex-wrap items-center justify-between gap-8 px-8 py-10">
      <div className="max-w-md space-y-4">
        <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
          {t('title')}
        </h1>

        <p className="text-muted-foreground text-pretty">{t('desc')}</p>

        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <Button asChild>
            <Link href="/admin" target="_blank">
              {t('go_to_admin_cp')}
            </Link>
          </Button>

          <Button asChild variant="ghost">
            <Link
              href="https://vitnode.com/docs"
              rel="noopener noreferrer"
              target="_blank"
            >
              {t('read_our_docs')}
            </Link>
          </Button>
        </div>
      </div>

      <LogoVitNode className="w-60" />
    </main>
  );
}
