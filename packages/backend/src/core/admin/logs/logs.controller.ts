import { Controllers } from '@/helpers/controller.decorator';
import { Get, Query } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import {
  ShowLogsAdminObj,
  ShowLogsAdminQuery,
} from 'vitnode-shared/admin/logs.dto';

import { ShowLogsAdminService } from './service/show.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'logs',
  isAdmin: true,
})
export class LogsAdminController {
  constructor(private readonly showLogsAdminService: ShowLogsAdminService) {}

  @ApiOkResponse({ type: ShowLogsAdminObj, description: 'Show logs' })
  @Get()
  async show(@Query() query: ShowLogsAdminQuery): Promise<ShowLogsAdminObj> {
    return await this.showLogsAdminService.show(query);
  }
}
