import { Controllers } from '@/helpers/controller.decorator';
import { Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { Legal, LegalsObj, LegalsQuery } from 'vitnode-shared/legal.dto';

import { ItemLegalService } from './services/item.service';
import { ShowLegalService } from './services/show.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'core',
  route: 'legal',
})
export class LegalController {
  constructor(
    private readonly showService: ShowLegalService,
    private readonly itemService: ItemLegalService,
  ) {}

  @ApiOkResponse({
    description: 'Item legal',
  })
  @Get(':code')
  async item(@Param('code') code: string): Promise<Legal> {
    return await this.itemService.item(code);
  }

  @ApiOkResponse({
    description: 'Show legal',
  })
  @Get()
  async show(@Query() query: LegalsQuery): Promise<LegalsObj> {
    return await this.showService.show(query);
  }
}
