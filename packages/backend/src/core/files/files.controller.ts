import { AuthGuard } from '@/guards/auth.guard';
import { CurrentUser } from '@/helpers/user.decorator';
import {
  Body,
  Controller,
  Delete,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  DeleteFilesQuery,
  ShowFile,
  UploadFilesBody,
} from 'vitnode-shared/files.dto';
import { User } from 'vitnode-shared/user.dto';

import { DeleteFilesService } from './services/delete.service';
import { UploadFilesService } from './services/upload.service';

@ApiTags('Core')
@Controller('core/files')
@UseGuards(AuthGuard)
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

  @ApiBody({
    description: 'Upload files',
    type: UploadFilesBody,
  })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({
    type: ShowFile,
  })
  @Post()
  @UseInterceptors(FileFieldsInterceptor([{ name: 'file', maxCount: 1 }]))
  async edit(
    @UploadedFiles()
    files: {
      file: Express.Multer.File[];
    },
    @Body() body: Omit<UploadFilesBody, 'file'>,
    @CurrentUser() user: User,
  ): Promise<ShowFile> {
    return await this.uploadFileService.upload({
      body: { file: files.file[0], ...body },
      user,
    });
  }
}
