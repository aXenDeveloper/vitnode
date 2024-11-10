import { Card } from '@/components/ui/card';
import { HeaderContent } from '@/components/ui/header-content';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export const generateMetadataSpamSecurityAdmin =
  async (): Promise<Metadata> => {
    const t = await getTranslations('admin.core.security.spam');

    return {
      title: {
        template: `%s - ${t('title')}`,
        default: t('title'),
      },
    };
  };

export const SpamSecurityAdminLayout = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const t = await getTranslations('admin.core.security.spam');

  return (
    <>
      <HeaderContent h1={t('title')} />
      <Card className="p-6">{children}</Card>
    </>
  );
};
