import { Controllers } from '@/helpers/controller.decorator';
import { FilesValidationPipe } from '@/helpers/files/files.pipe';
import { UploadFilesMethod } from '@/helpers/upload-files.decorator';
import { Body, Put, UploadedFiles } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import {
  EditThemeEditorStylesAdminBody,
  EditThemeEditorStylesAdminObj,
} from 'vitnode-shared/admin/styles/theme-editor.dto';

import { EditThemeEditorStylesAdminService } from './service/edit.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'styles',
  isAdmin: true,
  route: 'theme-editor',
})
export class ThemeEditorStylesAdminController {
  constructor(
    private readonly editService: EditThemeEditorStylesAdminService,
  ) {}

  @ApiOkResponse({
    description: 'Theme editor settings updated',
    type: EditThemeEditorStylesAdminObj,
  })
  @Put()
  @UploadFilesMethod({
    fields: [
      'logo_dark',
      'mobile_logo_dark',
      'logo_light',
      'mobile_logo_light',
    ],
  })
  async updateThemeEditor(
    @UploadedFiles(
      new FilesValidationPipe({
        logo_dark: {
          maxSize: 1024 * 1024, // 1 MB
          acceptMimeType: [
            'image/png',
            'image/jpeg',
            'image/svg+xml',
            'image/webp',
          ],
          isOptional: true,
          maxCount: 1,
        },
        mobile_logo_dark: {
          maxSize: 1024 * 1024, // 1 MB
          acceptMimeType: [
            'image/png',
            'image/jpeg',
            'image/svg+xml',
            'image/webp',
          ],
          isOptional: true,
          maxCount: 1,
        },
        logo_light: {
          maxSize: 1024 * 1024, // 1 MB
          acceptMimeType: [
            'image/png',
            'image/jpeg',
            'image/svg+xml',
            'image/webp',
          ],
          isOptional: true,
          maxCount: 1,
        },
        mobile_logo_light: {
          maxSize: 1024 * 1024, // 1 MB
          acceptMimeType: [
            'image/png',
            'image/jpeg',
            'image/svg+xml',
            'image/webp',
          ],
          isOptional: true,
          maxCount: 1,
        },
      }),
    )
    files: Pick<
      EditThemeEditorStylesAdminBody,
      'logo_dark' | 'logo_light' | 'mobile_logo_dark' | 'mobile_logo_light'
    >,
    @Body()
    body: EditThemeEditorStylesAdminBody,
  ): Promise<EditThemeEditorStylesAdminObj> {
    return await this.editService.update({
      body,
      files,
    });
  }
}
