'use client';

import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Link } from '@/lib/navigation';
import { logOutMutationApi } from '@/views/layouts/theme/header/user/auth/log-out-mutation-api';
import { HomeIcon, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';

export const ClientUserBarAdmin = ({
  user,
}: {
  user: {
    email: string;
    name: string;
  };
}) => {
  const t = useTranslations('core.global.user_bar');

  return (
    <>
      <DropdownMenuLabel className="p-0 font-normal">
        <div className="flex flex-col px-2 py-2 text-left">
          <span className="font-medium">{user.name}</span>
          <span className="text-muted-foreground text-xs">{user.email}</span>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem asChild>
          <Link href="/" target="_blank">
            <HomeIcon className="size-4" />
            Home
          </Link>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="text-destructive focus:text-destructive"
        onClick={async () => {
          await logOutMutationApi({ isAdmin: true });
        }}
      >
        <LogOut className="size-4" />
        {t('log_out')}
      </DropdownMenuItem>
    </>
  );
};
