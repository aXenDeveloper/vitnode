import { AuthGuard } from '@/guards/auth.guard';
import { CurrentUser } from '@/helpers/user.decorator';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ShowDevicesSettingsAuthObj } from 'vitnode-shared/auth/settings/devices.dto';
import { User } from 'vitnode-shared/user.dto';

import { ShowDevicesSettingsAuthService } from './services/show.service';

@ApiTags('Core')
@Controller('core/auth/settings/devices')
@ApiSecurity('')
@UseGuards(AuthGuard)
export class DevicesSettingsAuthController {
  constructor(private readonly showService: ShowDevicesSettingsAuthService) {}

  @Get()
  @ApiOkResponse({
    description: 'Devices settings',
    type: [ShowDevicesSettingsAuthObj],
  })
  async show(@CurrentUser() user: User): Promise<ShowDevicesSettingsAuthObj[]> {
    return await this.showService.show(user);
  }
}
