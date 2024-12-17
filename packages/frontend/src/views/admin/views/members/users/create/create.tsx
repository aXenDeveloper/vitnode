'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader } from '@/components/ui/loader';
import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

const Content = React.lazy(async () =>
  import('./content').then(module => ({
    default: module.ContentCreateUserUsersMembersAdmin,
  })),
);

export const CreateUserUsersMembersAdmin = () => {
  const t = useTranslations('admin.members.users.create');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <UserPlus />
          {t('title')}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <Content />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
