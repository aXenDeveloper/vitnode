import { Controllers } from '@/helpers/controller.decorator';
import { Get } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { ShowDashboardAdminObj } from 'vitnode-shared/admin/dashboard.dto';

import { ShowDashboardAdminService } from './services/show.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'dashboard',
  isAdmin: true,
})
export class DashboardAdminController {
  constructor(private readonly showService: ShowDashboardAdminService) {}

  @ApiOkResponse({
    type: ShowDashboardAdminObj,
    description: 'Show dashboard info',
  })
  @Get()
  async show() {
    return await this.showService.show();
  }
}
