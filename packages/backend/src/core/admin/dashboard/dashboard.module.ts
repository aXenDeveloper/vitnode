import { Module } from '@nestjs/common';

import { DashboardAdminController } from './dashboard.controller';
import { ShowDashboardAdminService } from './services/show.service';

@Module({
  providers: [ShowDashboardAdminService],
  controllers: [DashboardAdminController],
})
export class DashboardAdminModule {}
