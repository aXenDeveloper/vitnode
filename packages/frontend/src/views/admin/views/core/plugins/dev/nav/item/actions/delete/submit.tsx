import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';

export const SubmitDeleteActionTableNavDevPluginAdmin = () => {
  const t = useTranslations('admin.core.plugins.dev.nav.delete');
  const { pending } = useFormStatus();

  return (
    <Button loading={pending} type="submit" variant="destructive">
      {t('submit')}
    </Button>
  );
};
