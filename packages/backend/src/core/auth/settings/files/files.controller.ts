import { AuthGuard } from '@/guards/auth.guard';
import { CurrentUser } from '@/helpers/user.decorator';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  ShowFilesSettingsAuthObj,
  ShowFilesSettingsAuthQuery,
} from 'vitnode-shared/auth/settings/files.dto';
import { User } from 'vitnode-shared/user.dto';

import { ShowFilesSettingsAuthServices } from './services/show.service';

@ApiSecurity('')
@ApiTags('Core')
@Controller('core/auth/settings/files')
@UseGuards(AuthGuard)
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
