import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import { FilesValidationPipe } from '@/helpers/files/files.pipe';
import { CurrentUser } from '@/helpers/user.decorator';
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
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

@ApiSecurity('admin')
@ApiTags('Admin')
@Controller('admin/settings/email')
@UseGuards(AdminAuthGuard)
export class EmailSettingsAdminController {
  constructor(
    private readonly showService: ShowEmailSettingsAdminService,
    private readonly editService: EditEmailSettingsAdminService,
    private readonly testService: TestEmailSettingsAdminService,
    private readonly logsService: LogsEmailSettingsAdminService,
  ) {}

  @ApiBody({
    description: 'Edit email settings',
    type: EditEmailSettingsAdminBody,
  })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({
    description: 'Email settings updated',
    type: ShowEmailSettingsAdminObj,
  })
  @Put()
  @UseInterceptors(FileFieldsInterceptor([{ name: 'logo', maxCount: 1 }]))
  async edit(
    @UploadedFiles(
      new FilesValidationPipe({
        logo: {
          maxSize: 1024 * 1024, // 1 MB
          acceptMimeType: ['image/jpeg', 'image/png', 'image/gif'],
          isOptional: true,
        },
      }),
    )
    files: {
      logo?: Express.Multer.File[];
    },
    @Body() body: Omit<EditEmailSettingsAdminBody, 'logo'>,
  ): Promise<ShowEmailSettingsAdminObj> {
    return await this.editService.edit({ ...body, logo: files.logo?.at(0) });
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
