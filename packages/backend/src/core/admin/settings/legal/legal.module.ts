import { Module } from '@nestjs/common';

import { LegalSettingsAdminController } from './legal.controller';
import { CreateLegalSettingsAdminService } from './services/create.service';

@Module({
  providers: [CreateLegalSettingsAdminService],
  controllers: [LegalSettingsAdminController],
})
export class LegalSettingsAdminModule {}
