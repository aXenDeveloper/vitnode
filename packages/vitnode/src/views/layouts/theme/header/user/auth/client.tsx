'use client';

import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { SessionApi } from '@/lib/api/get-session-api';
import { Link } from '@/lib/navigation';
import { KeyRoundIcon, LogOutIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { logOutMutationApi } from './log-out-mutation-api';

export const ClientAuthUserHeader = ({
  user,
}: {
  user: NonNullable<SessionApi['user']>;
}) => {
  const t = useTranslations('core.global.user_bar');

  return (
    <>
      {user.isAdmin && (
        <>
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/admin" target="_blank">
                <KeyRoundIcon />
                <span>{t('admin_cp')}</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
        </>
      )}

      <DropdownMenuGroup>
        <DropdownMenuItem
          onClick={async () => {
            await logOutMutationApi({});
          }}
        >
          <LogOutIcon />
          <span>{t('log_out')}</span>
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>
  );
};
