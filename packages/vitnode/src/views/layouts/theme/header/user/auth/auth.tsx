import { Avatar } from '@/components/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getSessionApi } from '@/lib/api/get-session-api';

import { ClientAuthUserHeader } from './client';

export const AuthUserHeader = async () => {
  const { user } = await getSessionApi();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={user.name} size="icon" variant="ghost">
          <Avatar size={24} user={user} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 p-2">
        <ClientAuthUserHeader user={user} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
