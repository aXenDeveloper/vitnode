import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';

export const SubmitDeleteActionsTableAdministratorsStaffAdmin = () => {
  const t = useTranslations('admin.members.staff.admin.delete');
  const { pending } = useFormStatus();

  return (
    <Button loading={pending} type="submit" variant="destructive">
      {t('submit')}
    </Button>
  );
};
