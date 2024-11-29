import { Controllers } from '@/helpers/controller.decorator';
import { CurrentUser } from '@/helpers/user.decorator';
import { Get } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { ShowDevicesSettingsAuthObj } from 'vitnode-shared/auth/settings/devices.dto';
import { User } from 'vitnode-shared/user.dto';

import { ShowDevicesSettingsAuthService } from './services/show.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'core',
  route: 'auth/settings/devices',
  isProtect: true,
})
export class DevicesSettingsAuthController {
  constructor(private readonly showService: ShowDevicesSettingsAuthService) {}

  @ApiOkResponse({
    description: 'Devices settings',
    type: [ShowDevicesSettingsAuthObj],
  })
  @Get()
  async show(@CurrentUser() user: User): Promise<ShowDevicesSettingsAuthObj[]> {
    return await this.showService.show(user);
  }
}
