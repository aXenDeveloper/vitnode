import { Controllers } from '@/helpers/controller.decorator';
import { Get } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { ShowMiddlewareObj } from 'vitnode-shared/middleware.dto';

import { ShowMiddlewareService } from './services/show.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'core',
  route: 'middleware',
})
export class MiddlewareController {
  constructor(private readonly showService: ShowMiddlewareService) {}

  @ApiOkResponse({
    type: ShowMiddlewareObj,
    description: 'Show middleware',
  })
  @Get()
  async show(): Promise<ShowMiddlewareObj> {
    return this.showService.show();
  }
}
