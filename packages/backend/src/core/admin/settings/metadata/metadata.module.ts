import { Module } from '@nestjs/common';

import { MetadataAdminController } from './metadata.controller';
import { EditMetadataAdminService } from './services/edit.service';
import { ShowMetadataAdminService } from './services/show.service';

@Module({
  providers: [ShowMetadataAdminService, EditMetadataAdminService],
  controllers: [MetadataAdminController],
})
export class MetadataSettingsAdminModule {}
