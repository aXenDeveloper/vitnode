import { Module } from '@nestjs/common';

import { LogsAdminController } from './logs.controller';
import { ShowLogsAdminService } from './service/show.service';

@Module({
  providers: [ShowLogsAdminService],
  controllers: [LogsAdminController],
})
export class LogsAdminModule {}
