import { Card } from '@/components/ui/card';
import { HeaderContent } from '@/components/ui/header-content';
import { getTranslations } from 'next-intl/server';

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
