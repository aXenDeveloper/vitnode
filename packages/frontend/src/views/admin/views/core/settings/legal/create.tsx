'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CreateEditLegalPage } from './create_edit/create_edit';

export const CreateLegalSettingsAdmin = () => {
  const t = useTranslations('admin.core.settings.legal.create_edit.create');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {t('title')}
        </Button>
      </DialogTrigger>

      <CreateEditLegalPage />
    </Dialog>
  );
};
