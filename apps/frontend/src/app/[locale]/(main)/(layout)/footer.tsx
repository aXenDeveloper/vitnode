import { getTranslations } from 'next-intl/server';
import { Link } from 'vitnode-frontend/navigation';

export const Footer = async () => {
  const t = await getTranslations('core.legal');

  return (
    <footer className="container mb-14 mt-6 flex flex-col items-center justify-between gap-4 border-t py-6 text-sm sm:mb-0 sm:flex-row">
      <Link className="text-muted-foreground" href="https://vitnode.com/">
        Powered by <span className="text-primary font-medium">VitNode</span>
      </Link>

      <div>
        <Link href="/legal">{t('title')}</Link>
      </div>
    </footer>
  );
};
