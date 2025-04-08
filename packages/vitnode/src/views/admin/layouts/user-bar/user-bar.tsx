'use client';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getSessionAdminApi } from '@/lib/api/get-session-admin-api';

import { ClientUserBarAdmin } from './client';

export const UserBarAdmin = ({
  user,
}: Pick<
  NonNullable<Awaited<ReturnType<typeof getSessionAdminApi>>>,
  'user'
>) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost">
          <Avatar size={24} user={user} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
        side="bottom"
        sideOffset={4}
      >
        <ClientUserBarAdmin user={user} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
