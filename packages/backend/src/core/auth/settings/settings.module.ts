import { Module } from '@nestjs/common';

import { DevicesSettingsAuthModule } from './devices/devices.module';
import { FilesSettingsAuthModule } from './files/files.module';
import { UserSettingsAuthModule } from './user/user.module';

@Module({
  imports: [
    DevicesSettingsAuthModule,
    FilesSettingsAuthModule,
    UserSettingsAuthModule,
  ],
})
export class SettingsAuthModule {}
