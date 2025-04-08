'use client';

import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { mutationApi } from './mutation-api';

export const ButtonSSOButtons = ({
  children,
  providerId,
}: {
  children: React.ReactNode;
  providerId: string;
}) => {
  const tErrors = useTranslations('core.global.errors');

  return (
    <Button
      className="bg-card w-[calc(50%-0.5rem)]"
      onClick={async () => {
        const mutation = await mutationApi(providerId);

        if (mutation?.message) {
          toast.error(tErrors('title'), {
            description: tErrors('internal_server_error'),
          });
        }
      }}
      variant="outline"
    >
      {children}
    </Button>
  );
};
