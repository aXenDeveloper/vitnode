import { Module } from '@nestjs/common';

import { DevicesSettingsAuthModule } from './devices/devices.module';
import { FilesSettingsAuthModule } from './files/files.module';

@Module({
  imports: [DevicesSettingsAuthModule, FilesSettingsAuthModule],
})
export class SettingsAuthModule {}
