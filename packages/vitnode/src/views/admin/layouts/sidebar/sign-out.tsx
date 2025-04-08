'use client';

import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { logOutMutationApi } from '@/views/layouts/theme/header/user/auth/log-out-mutation-api';

export const SignOutUserFooterSidebarAdmin = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <DropdownMenuItem
      onClick={async () => {
        await logOutMutationApi({ isAdmin: true });
      }}
    >
      {children}
    </DropdownMenuItem>
  );
};
