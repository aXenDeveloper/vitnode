import { MiddlewareModule } from '@/core/middleware/middleware.module';
import { Module } from '@nestjs/common';

import { NavStylesAdminController } from './nav.controller';
import { ChangePositionNavStylesAdminService } from './services/change_position.service';
import { CreateNavStylesAdminService } from './services/create.service';
import { DeleteNavStylesAdminService } from './services/delete.service';
import { EditNavStylesAdminService } from './services/edit.service';

@Module({
  providers: [
    CreateNavStylesAdminService,
    DeleteNavStylesAdminService,
    EditNavStylesAdminService,
    ChangePositionNavStylesAdminService,
  ],
  controllers: [NavStylesAdminController],
  imports: [MiddlewareModule],
})
export class NavStylesAdminModule {}
