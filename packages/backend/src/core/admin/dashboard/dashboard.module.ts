import { Module } from '@nestjs/common';

import { DashboardAdminController } from './dashboard.controller';
import { EditNoteDashboardAdminService } from './services/edit-note.service';
import { ShowDashboardAdminService } from './services/show.service';

@Module({
  providers: [ShowDashboardAdminService, EditNoteDashboardAdminService],
  controllers: [DashboardAdminController],
})
export class DashboardAdminModule {}
