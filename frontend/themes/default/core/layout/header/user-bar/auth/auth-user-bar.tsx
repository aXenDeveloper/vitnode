'use client';

import { Settings, User } from 'lucide-react';
import { useRouter } from 'next-intl/client';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

export const AuthUserBar = () => {
  const t = useTranslations('core');
  const { push } = useRouter();

  const id = 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Open</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => push(`/profiles/${id}`)}>
            <User className="mr-2 h-4 w-4" />
            <span>{t('user-bar.my_profile')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => push('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            <span>{t('user-bar.settings')}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};