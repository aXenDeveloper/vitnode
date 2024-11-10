import { Module } from '@nestjs/common';

import { FilesSettingsAuthController } from './files.controller';
import { ShowFilesSettingsAuthServices } from './services/show.service';

@Module({
  providers: [ShowFilesSettingsAuthServices],
  controllers: [FilesSettingsAuthController],
})
export class FilesSettingsAuthModule {}
