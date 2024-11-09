import { Module } from '@nestjs/common';

import { DevicesSettingsAuthController } from './devices.controller';
import { ShowDevicesSettingsAuthService } from './services/show.service';

@Module({
  providers: [ShowDevicesSettingsAuthService],
  controllers: [DevicesSettingsAuthController],
})
export class DevicesSettingsAuthModule {}
