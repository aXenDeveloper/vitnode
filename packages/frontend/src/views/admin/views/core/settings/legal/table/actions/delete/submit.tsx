import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';

export const SubmitDeleteContentLegalSettingsAdmin = () => {
  const t = useTranslations('admin.core.settings.legal.delete');
  const { pending } = useFormStatus();

  return (
    <Button loading={pending} type="submit" variant="destructive">
      {t('confirm')}
    </Button>
  );
};
