import { getSessionData } from '@/api/get-session-data';
import { Card } from '@/components/ui/card';
import { AvatarUser } from '@/components/ui/user/avatar';
import { GroupFormat } from '@/components/ui/user/group-format';

import { BasicInfoOverviewSettings } from './basic-info/basic-info';
import { ChangeAvatarWrapper } from './change-avatar/change-avatar-wrapper';

export const OverviewSettingsView = async () => {
  const { user } = await getSessionData();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <Card className="flex flex-col items-center justify-between gap-4 p-6 sm:flex-row">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-6 sm:text-left">
          <ChangeAvatarWrapper>
            <AvatarUser sizeInRem={4} user={user} />
          </ChangeAvatarWrapper>
          <div className="leading-none">
            <h1 className="text-2xl font-semibold">{user.name}</h1>
            <GroupFormat className="text-sm" group={user.group} />
          </div>
        </div>

        {/* <div>test123</div> */}
      </Card>

      <BasicInfoOverviewSettings />
    </div>
  );
};
