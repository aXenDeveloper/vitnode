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
import { useSignOutApi } from '@/hooks/sign/out/use-sign-out-api';
import { LogOutIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { UserWithDangerousInfo } from 'vitnode-shared/user.dto';

export const AuthUserBar = ({
  className,
  user: { email, name, name_seo, avatar_color },
}: {
  className?: string;
  user: UserWithDangerousInfo;
}) => {
  const t = useTranslations('core.global.user-bar');
  const { onSubmit } = useSignOutApi();

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
            }}
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 p-2">
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
          <DropdownMenuItem onClick={onSubmit}>
            <LogOutIcon />
            <span>{t('log_out')}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
