import { Controllers } from '@/helpers/controller.decorator';
import { Get } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { ShowCronAdvancedAdminObj } from 'vitnode-shared/admin/advanced/cron.dto';

import { ShowCronAdvancedAdminService } from './services/show.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'advanced',
  isAdmin: true,
  route: 'cron',
})
export class CoreAdvancedAdminController {
  constructor(private readonly showService: ShowCronAdvancedAdminService) {}

  @ApiOkResponse({
    type: ShowCronAdvancedAdminObj,
    description: 'Show cron jobs',
  })
  @Get()
  show(): ShowCronAdvancedAdminObj {
    return this.showService.show();
  }
}
