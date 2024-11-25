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
import { cn } from '@/helpers/classnames';
import { Link } from '@/navigation';
import { useSignOutApi } from '@/views/theme/layout/header/auth-user-bar/hooks/use-sign-out-api';
import { KeyRoundIcon, LogOutIcon, SettingsIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { UserWithDangerousInfo } from 'vitnode-shared/user.dto';

export const AuthUserBar = ({
  className,
  user: { email, name, name_seo, avatar_color, avatar, is_admin },
}: {
  className?: string;
  user: UserWithDangerousInfo;
}) => {
  const t = useTranslations('core.global.user-bar');
  const { onSubmit } = useSignOutApi({});

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ariaLabel=""
          className={cn('hidden shrink-0 rounded-full sm:flex', className)}
          size="icon"
          variant="ghost"
        >
          <AvatarUser
            sizeInRem={1.75}
            user={{
              avatar_color,
              name,
              name_seo,
              avatar,
            }}
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 p-2">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <span className="font-semibold leading-none">{name}</span>
            <p className="text-muted-foreground text-sm leading-none">
              {email}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {/* <DropdownMenuItem asChild>
            <Link href={`/profile/${name_seo}`}>
              <User />
              <span>{t('my_profile')}</span>
            </Link>
          </DropdownMenuItem> */}
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <SettingsIcon />
              <span>{t('settings')}</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {is_admin && (
          <>
            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              {is_admin && (
                <DropdownMenuItem asChild>
                  <Link href="/admin" target="_blank">
                    <KeyRoundIcon />
                    <span>{t('admin_cp')}</span>
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onSubmit}>
            <LogOutIcon />
            <span>{t('log_out')}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
