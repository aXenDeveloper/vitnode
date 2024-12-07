import { Module } from '@nestjs/common';

import { UploadAvatarUserSettingsAuthService } from './services/upload_avatar.service';
import { UserSettingsAuthController } from './user.controller';

@Module({
  providers: [UploadAvatarUserSettingsAuthService],
  controllers: [UserSettingsAuthController],
})
export class UserSettingsAuthModule {}
