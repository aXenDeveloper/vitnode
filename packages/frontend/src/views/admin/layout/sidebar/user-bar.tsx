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
import { useSignOutApi } from '@/hooks/sign/out/use-sign-out-api';
import { useSessionAdmin } from '@/hooks/use-session-admin';
import { Link } from '@/navigation';
import {
  HammerIcon,
  HomeIcon,
  LogOut,
  SquareArrowOutUpRight,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

export const UserBarSidebarAdmin = () => {
  const t = useTranslations('admin.global');
  const tCore = useTranslations('core.global');
  const { user, isInAdminPermission } = useSessionAdmin();
  const { name, email } = user;
  const { onSubmit } = useSignOutApi({ is_admin: true });

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
          {isInAdminPermission({
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
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link
              href="https://vitnode.com/"
              rel="noopener noreferrer"
              target="_blank"
            >
              VitNode
              <SquareArrowOutUpRight />
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link
              href="https://github.com/VitNode/vitnode"
              rel="noopener noreferrer"
              target="_blank"
            >
              VitNode GitHub
              <SquareArrowOutUpRight />
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onSubmit}>
            <LogOut /> <span>{tCore('user-bar.log_out')}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
