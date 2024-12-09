import { Button } from '@/components/ui/button';
import { TooltipWrapper } from '@/components/ui/tooltip';
import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';

export const ButtonSetDefaultPluginActionsAdmin = () => {
  const t = useTranslations('admin.core.plugins');
  const { pending } = useFormStatus();

  return (
    <TooltipWrapper content={t('set_default')}>
      <Button
        ariaLabel={t('set_default')}
        loading={pending}
        size="icon"
        type="submit"
        variant="ghost"
      >
        <Star />
      </Button>
    </TooltipWrapper>
  );
};
