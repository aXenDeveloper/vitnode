'use client';

import { AlertDialog } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader } from '@/components/ui/loader';
import { useSessionAdmin } from '@/hooks/use-session-admin';
import { EllipsisIcon, Pencil, UserMinus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { UserMembersAdmin } from 'vitnode-shared/admin/members/users.dto';

import { ConfirmEmailActionUserMembersAdmin } from './confirm-email/confirm-email';
import { DeleteActionUserMembersAdmin } from './delete/delete';

const EditActionUserMembersAdmin = React.lazy(async () =>
  import('./edit/edit').then(module => ({
    default: module.EditActionUserMembersAdmin,
  })),
);

export const ActionsUserMembersAdmin = ({
  name,
  email_verified,
  ...props
}: UserMembersAdmin) => {
  const t = useTranslations('admin.members.users.item');
  const [isOpenEdit, setIsOpenEdit] = React.useState(false);
  const [isOpenDelete, setIsOpenDelete] = React.useState(false);
  const { user } = useSessionAdmin();

  return (
    <>
      {!email_verified && <ConfirmEmailActionUserMembersAdmin {...props} />}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ariaLabel={t('user_menu')}
            className="@lg:relative @lg:right-auto @lg:top-auto absolute right-4 top-20"
            size="icon"
            variant="ghost"
          >
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-44">
          <DropdownMenuItem
            onClick={() => {
              setIsOpenEdit(true);
            }}
          >
            <Pencil />
            {t('edit.title')}
          </DropdownMenuItem>
          <DropdownMenuItem
            destructive
            disabled={user?.id === props.id}
            onClick={() => {
              setIsOpenDelete(true);
            }}
          >
            <UserMinus />
            {t('delete.title')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog onOpenChange={setIsOpenEdit} open={isOpenEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('edit.title')}</DialogTitle>
            <DialogDescription>{name}</DialogDescription>
          </DialogHeader>

          <React.Suspense fallback={<Loader />}>
            <EditActionUserMembersAdmin name={name} {...props} />
          </React.Suspense>
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={setIsOpenDelete} open={isOpenDelete}>
        <DeleteActionUserMembersAdmin name={name} {...props} />
      </AlertDialog>
    </>
  );
};
