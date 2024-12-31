import { Module } from '@nestjs/common';

import { FilesCron } from './clean.core';
import { FilesController } from './files.controller';
import { DeleteFilesService } from './services/delete.service';
import { UploadFilesService } from './services/upload.service';

@Module({
  providers: [UploadFilesService, DeleteFilesService, FilesCron],
  controllers: [FilesController],
})
export class FilesModule {}
