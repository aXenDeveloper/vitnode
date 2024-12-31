import { Module } from '@nestjs/common';

import { CoreAdvancedAdminController } from './cron.controller';
import { ShowCronAdvancedAdminService } from './services/show.service';

@Module({
  providers: [ShowCronAdvancedAdminService],
  controllers: [CoreAdvancedAdminController],
})
export class CronAdvancedAdminModule {}
