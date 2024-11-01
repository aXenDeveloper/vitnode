import { Module } from '@nestjs/common';

import { FilesController } from './files.controller';
import { DeleteFilesService } from './services/delete.service';
import { UploadFilesService } from './services/upload.service';

@Module({
  providers: [UploadFilesService, DeleteFilesService],
  controllers: [FilesController],
})
export class FilesModule {}
