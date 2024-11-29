import { Controllers } from '@/helpers/controller.decorator';
import { CurrentUser } from '@/helpers/user.decorator';
import { Get, Query } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import {
  ShowFilesSettingsAuthObj,
  ShowFilesSettingsAuthQuery,
} from 'vitnode-shared/auth/settings/files.dto';
import { User } from 'vitnode-shared/user.dto';

import { ShowFilesSettingsAuthServices } from './services/show.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'core',
  route: 'auth/settings/files',
  isProtect: true,
})
export class FilesSettingsAuthController {
  constructor(private readonly showService: ShowFilesSettingsAuthServices) {}

  @ApiOkResponse({
    description: 'Show files settings',
    type: ShowFilesSettingsAuthObj,
  })
  @Get()
  async show(
    @Query() query: ShowFilesSettingsAuthQuery,
    @CurrentUser() user: User,
  ): Promise<ShowFilesSettingsAuthObj> {
    return await this.showService.show({ query, user });
  }
}
