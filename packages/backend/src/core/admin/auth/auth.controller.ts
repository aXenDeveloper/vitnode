import type { Request, Response } from 'express';

import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ShowAuthAdminObj } from 'vitnode-shared/admin/auth.dto';

import { ShowAuthAdminService } from './services/show.service';

@ApiTags('Admin')
@Controller('admin/auth')
@ApiSecurity('admin')
export class AuthAdminController {
  constructor(private readonly showService: ShowAuthAdminService) {}

  @Get()
  @ApiOkResponse({
    type: ShowAuthAdminObj,
  })
  async show(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ShowAuthAdminObj> {
    return await this.showService.show({ req, res });
  }
}
