import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader } from '@/components/ui/loader';
import { useTextLang } from '@/hooks/use-text-lang';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { GroupsMembersAdminObj } from 'vitnode-shared/admin/members/groups.dto';

const Content = React.lazy(async () =>
  import('../../create-edit-form/create-edit-form-groups-members-admin').then(
    module => ({
      default: module.CreateEditFormGroupsMembersAdmin,
    }),
  ),
);

export const EditGroupsMembersDialogAdmin = (
  data: GroupsMembersAdminObj['edges'][0],
) => {
  const t = useTranslations('admin.members.groups.create');
  const { convertText } = useTextLang();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button ariaLabel={t('title')} size="icon" variant="ghost">
          <Pencil />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{convertText(data.name)}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <Content data={data} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
