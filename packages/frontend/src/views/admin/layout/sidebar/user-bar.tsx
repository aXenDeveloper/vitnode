'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AvatarUser } from '@/components/ui/user/avatar';
import { useSessionAdmin } from '@/hooks/use-session-admin';
import { Link } from '@/navigation';
import { HomeIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

export const UserBarSidebarAdmin = () => {
  const t = useTranslations('admin.global');
  const { user } = useSessionAdmin();
  const { name, email } = user;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ariaLabel=""
          className="shrink-0 rounded-full"
          size="icon"
          variant="ghost"
        >
          <AvatarUser sizeInRem={1.75} user={user} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64 p-2">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-base font-medium leading-none">{name}</p>
            <p className="text-muted-foreground text-xs leading-none">
              {email}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/" target="_blank">
              <HomeIcon />
              <span>{t('home_page')}</span>
            </Link>
          </DropdownMenuItem>
          {/* <DropdownMenuItem asChild>
            <Link href={`/profile/${name_seo}`} target="_blank">
              <UserIcon />
              <span>{tCore('user-bar.my_profile')}</span>
            </Link>
          </DropdownMenuItem> */}
          {/* {isInAdminPermission({
            plugin_code: 'core',
            group: 'dashboard',
            permission: 'can_manage_diagnostic_tools',
          }) && (
            <DropdownMenuItem asChild>
              <Link href="/admin/core/diagnostic">
                <HammerIcon />
                <span>{t('diagnostic_tools')}</span>
              </Link>
            </DropdownMenuItem>
          )} */}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
