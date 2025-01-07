import { Controllers } from '@/helpers/controller.decorator';
import { CurrentUser } from '@/helpers/user.decorator';
import { Body, Delete, Post, Query, UploadedFiles } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import {
  DeleteFilesQuery,
  ShowFile,
  UploadFilesBody,
} from 'vitnode-shared/files.dto';
import { User } from 'vitnode-shared/user.dto';

import { DeleteFilesService } from './services/delete.service';
import { UploadFilesService } from './services/upload.service';
import { UploadFilesMethod } from '@/helpers/upload-files.decorator';
import { FilesValidationPipe } from '@/helpers/files/files.pipe';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'core',
  route: 'files',
  isProtect: true,
})
export class FilesController {
  constructor(
    private readonly uploadFileService: UploadFilesService,
    private readonly deleteFileService: DeleteFilesService,
  ) {}

  @ApiOkResponse()
  @Delete()
  async delete(@Query() query: DeleteFilesQuery, @CurrentUser() user: User) {
    return await this.deleteFileService.delete({ query, user });
  }

  @ApiCreatedResponse({
    type: ShowFile,
  })
  @Post()
  @UploadFilesMethod({ fields: ['file'] })
  async edit(
    @UploadedFiles(
      new FilesValidationPipe({
        file: {
          maxSize: 1024 * 1024 * 10, // 10 MB
          acceptMimeType: ['image/png', 'image/jpeg', 'image/webp'],
          maxCount: 1,
        },
      }),
    )
    files: Pick<UploadFilesBody, 'file'>,
    @Body() body: Omit<UploadFilesBody, 'file'>,
    @CurrentUser() user: User,
  ): Promise<ShowFile> {
    return await this.uploadFileService.upload({
      body: { file: files.file, ...body },
      user,
    });
  }
}
