import { Controllers } from '@/helpers/controller.decorator';
import { FilesValidationPipe } from '@/helpers/files/files.pipe';
import { UploadFilesMethod } from '@/helpers/upload-files.decorator';
import { CurrentUser } from '@/helpers/user.decorator';
import { Body, Put, UploadedFiles } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { UploadAvatarUserSettingsAuthBody } from 'vitnode-shared/auth/settings/user.dto';
import { User } from 'vitnode-shared/user.dto';

import { UploadAvatarUserSettingsAuthService } from './services/upload_avatar.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'core',
  route: 'auth/settings/user',
  isProtect: true,
})
export class UserSettingsAuthController {
  constructor(
    private readonly uploadAvatarService: UploadAvatarUserSettingsAuthService,
  ) {}

  @ApiOkResponse({
    description: 'Upload or delete avatar',
  })
  @Put('avatar')
  @UploadFilesMethod({
    fields: ['avatar'],
  })
  async uploadAvatar(
    @UploadedFiles(
      new FilesValidationPipe({
        avatar: {
          maxSize: 1024 * 1024 * 2, // 2 MB
          acceptMimeType: ['image/png', 'image/jpeg', 'image/webp'],
          isOptional: true,
          maxCount: 1,
        },
      }),
    )
    files: Pick<UploadAvatarUserSettingsAuthBody, 'avatar'>,
    @Body() body: UploadAvatarUserSettingsAuthBody,
    @CurrentUser() currentUser: User,
  ): Promise<void> {
    await this.uploadAvatarService.uploadAvatar({
      body,
      files,
      currentUser,
    });
  }
}
