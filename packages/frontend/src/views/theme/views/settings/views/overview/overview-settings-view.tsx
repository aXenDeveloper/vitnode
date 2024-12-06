import { getSessionData } from '@/api/get-session-data';
import { Card } from '@/components/ui/card';
import { AvatarUser } from '@/components/ui/user/avatar';

import { ChangeAvatarWrapper } from './change-avatar/change-avatar-wrapper';

export const OverviewSettingsView = async () => {
  const { user } = await getSessionData();
  if (!user) return null;

  return (
    <Card className="p-6">
      <ChangeAvatarWrapper>
        <AvatarUser sizeInRem={4} user={user} />
      </ChangeAvatarWrapper>
    </Card>
  );
};
