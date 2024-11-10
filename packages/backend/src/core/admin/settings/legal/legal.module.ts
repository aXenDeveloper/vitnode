import { Module } from '@nestjs/common';

import { LegalSettingsAdminController } from './legal.controller';
import { CreateLegalSettingsAdminService } from './services/create.service';
import { DeleteLegalSettingsAdminService } from './services/delete.service';
import { EditLegalSettingsAdminService } from './services/edit.service';

@Module({
  providers: [
    CreateLegalSettingsAdminService,
    EditLegalSettingsAdminService,
    DeleteLegalSettingsAdminService,
  ],
  controllers: [LegalSettingsAdminController],
})
export class LegalSettingsAdminModule {}
