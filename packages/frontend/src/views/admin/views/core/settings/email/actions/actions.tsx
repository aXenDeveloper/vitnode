import { Button } from '@/components/ui/button';
import { Link } from '@/navigation';
import { MailWarningIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { TestingActionEmailSettingsAdmin } from './testing/testing';

export const ActionsEmailSettingsAdmin = ({
  disabled,
}: {
  disabled: boolean;
}) => {
  const t = useTranslations('admin.core.settings.email.logs');

  return (
    <>
      <Button asChild variant="ghost">
        <Link href="/admin/core/settings/email/logs">
          <MailWarningIcon />
          {t('title')}
        </Link>
      </Button>
      <TestingActionEmailSettingsAdmin disabled={disabled} />
    </>
  );
};
