import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import { FilesValidationPipe } from '@/helpers/files/files.pipe';
import {
  Body,
  Controller,
  Put,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import {
  EditThemeEditorStylesAdminBody,
  EditThemeEditorStylesAdminObj,
} from 'vitnode-shared/admin/styles/theme-editor.dto';

import { EditThemeEditorStylesAdminService } from './service/edit.service';

@ApiTags('Admin')
@Controller('admin/styles/theme-editor')
@ApiSecurity('admin')
@UseGuards(AdminAuthGuard)
export class ThemeEditorStylesAdminController {
  constructor(
    private readonly editService: EditThemeEditorStylesAdminService,
  ) {}

  @Put()
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({
    description: 'Theme editor settings updated',
    type: EditThemeEditorStylesAdminObj,
  })
  @ApiBody({
    description: 'Edit theme editor settings',
    type: EditThemeEditorStylesAdminBody,
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'logo_dark', maxCount: 1 },
      { name: 'mobile_logo_dark', maxCount: 1 },
      { name: 'logo_light', maxCount: 1 },
      { name: 'mobile_logo_light', maxCount: 1 },
    ]),
  )
  async updateThemeEditor(
    @UploadedFiles(
      new FilesValidationPipe({
        logo_dark: {
          maxSize: 1024 * 1024, // 1 MB
          acceptMimeType: ['image/png', 'image/jpeg'],
          isOptional: true,
        },
        mobile_logo_dark: {
          maxSize: 1024 * 1024, // 1 MB
          acceptMimeType: ['image/png', 'image/jpeg'],
          isOptional: true,
        },
        logo_light: {
          maxSize: 1024 * 1024, // 1 MB
          acceptMimeType: ['image/png', 'image/jpeg'],
          isOptional: true,
        },
        mobile_logo_light: {
          maxSize: 1024 * 1024, // 1 MB
          acceptMimeType: ['image/png', 'image/jpeg'],
          isOptional: true,
        },
      }),
    )
    files: {
      logo_dark?: Express.Multer.File[];
      logo_light?: Express.Multer.File[];
      mobile_logo_dark?: Express.Multer.File[];
      mobile_logo_light?: Express.Multer.File[];
    },
    @Body()
    body: Omit<
      EditThemeEditorStylesAdminBody,
      'logo_dark' | 'logo_light' | 'mobile_logo_dark' | 'mobile_logo_light'
    >,
  ): Promise<EditThemeEditorStylesAdminObj> {
    return await this.editService.update({
      ...body,
      logo_dark: files.logo_dark?.at(0),
      mobile_logo_dark: files.mobile_logo_dark?.at(0),
      logo_light: files.logo_light?.at(0),
      mobile_logo_light: files.mobile_logo_light?.at(0),
    });
  }
}
