import { Module } from '@nestjs/common';

import { HelpersShowMetadataAdminService } from './helpers.service';
import { MetadataAdminController } from './metadata.controller';
import { EditMetadataAdminService } from './services/edit.service';
import { ShowMetadataAdminService } from './services/show.service';

@Module({
  providers: [
    ShowMetadataAdminService,
    HelpersShowMetadataAdminService,
    EditMetadataAdminService,
  ],
  controllers: [MetadataAdminController],
})
export class MetadataSettingsAdminModule {}
