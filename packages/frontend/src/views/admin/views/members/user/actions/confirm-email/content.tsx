import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';

export const ContentConfirmEmailActionUserMembersAdmin = () => {
  const { pending } = useFormStatus();
  const t = useTranslations('admin.members.users.item.confirm_email');

  return (
    <Button loading={pending} type="submit">
      <Check />
      {t('title')}
    </Button>
  );
};
