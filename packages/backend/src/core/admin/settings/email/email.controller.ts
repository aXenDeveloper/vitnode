import { Controllers } from '@/helpers/controller.decorator';
import { FilesValidationPipe } from '@/helpers/files/files.pipe';
import { UploadFilesMethod } from '@/helpers/upload-files.decorator';
import { CurrentUser } from '@/helpers/user.decorator';
import { Body, Get, Post, Put, Query, UploadedFiles } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import {
  EditEmailSettingsAdminBody,
  LogsEmailSettingsAdminObj,
  LogsEmailSettingsAdminQuery,
  ShowEmailSettingsAdminObj,
  TestEmailSettingsAdminBody,
} from 'vitnode-shared/admin/settings/email.dto';
import { User } from 'vitnode-shared/user.dto';

import { EditEmailSettingsAdminService } from './services/edit.service';
import { LogsEmailSettingsAdminService } from './services/lags.service';
import { ShowEmailSettingsAdminService } from './services/show.service';
import { TestEmailSettingsAdminService } from './services/test.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'settings',
  isAdmin: true,
  route: 'email',
})
export class EmailSettingsAdminController {
  constructor(
    private readonly showService: ShowEmailSettingsAdminService,
    private readonly editService: EditEmailSettingsAdminService,
    private readonly testService: TestEmailSettingsAdminService,
    private readonly logsService: LogsEmailSettingsAdminService,
  ) {}

  @ApiOkResponse({
    description: 'Email settings updated',
    type: ShowEmailSettingsAdminObj,
  })
  @Put()
  @UploadFilesMethod({ fields: ['logo'] })
  async edit(
    @UploadedFiles(
      new FilesValidationPipe({
        logo: {
          maxSize: 1024 * 1024, // 1 MB
          acceptMimeType: ['image/jpeg', 'image/png', 'image/gif'],
          isOptional: true,
          maxCount: 1,
        },
      }),
    )
    files: Pick<EditEmailSettingsAdminBody, 'logo'>,
    @Body() body: EditEmailSettingsAdminBody,
  ): Promise<ShowEmailSettingsAdminObj> {
    return await this.editService.edit({ body, files });
  }

  @ApiOkResponse({
    type: LogsEmailSettingsAdminObj,
    description: 'Logs email settings',
  })
  @Get('/logs')
  async logs(
    @Query() body: LogsEmailSettingsAdminQuery,
  ): Promise<LogsEmailSettingsAdminObj> {
    return await this.logsService.logs(body);
  }

  @ApiOkResponse({
    type: ShowEmailSettingsAdminObj,
    description: 'Show email settings',
  })
  @Get()
  show(): ShowEmailSettingsAdminObj {
    return this.showService.show();
  }

  @ApiOkResponse({ description: 'Test email settings' })
  @Post('/test')
  async test(
    @Body() body: TestEmailSettingsAdminBody,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.testService.test({ body, user });
  }
}
