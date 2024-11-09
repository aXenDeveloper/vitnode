import { Module } from '@nestjs/common';

import { DevicesSettingsAuthModule } from './devices/devices.module';

@Module({
  imports: [DevicesSettingsAuthModule],
})
export class SettingsAuthModule {}
