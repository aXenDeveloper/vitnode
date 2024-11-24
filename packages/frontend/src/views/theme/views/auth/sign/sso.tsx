import { getMiddlewareData } from '@/api/get-middleware-data';
import { Button } from '@/components/ui/button';
import { Link } from '@/navigation';
import { getTranslations } from 'next-intl/server';

export const SSOSign = async () => {
  const [t, { auth_methods }] = await Promise.all([
    getTranslations('core.sign_in'),
    getMiddlewareData(),
  ]);

  return (
    <>
      <div className="space-y-4">
        {auth_methods.sso.map(sso => (
          <Button
            asChild
            className="bg-card w-full"
            key={sso.code}
            variant="outline"
          >
            <Link href={`/login/sso/${sso.code}`}>{sso.name}</Link>
          </Button>
        ))}
      </div>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background text-muted-foreground px-2">
            {t('or')}
          </span>
        </div>
      </div>
    </>
  );
};
