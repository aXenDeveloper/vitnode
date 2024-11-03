import type { Request, Response } from 'express';

import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import { CurrentUser } from '@/helpers/user.decorator';
import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  SearchNavAuthAdminObj,
  SearchNavAuthAdminQuery,
  ShowAuthAdminObj,
} from 'vitnode-shared/admin/auth.dto';
import { User } from 'vitnode-shared/user.dto';

import { SearchAuthAdminService } from './services/nav/search.service';
import { ShowAuthAdminService } from './services/show.service';

@ApiTags('Admin')
@Controller('admin/auth')
@ApiSecurity('admin')
@UseGuards(AdminAuthGuard)
export class AuthAdminController {
  constructor(
    private readonly showService: ShowAuthAdminService,
    private readonly searchService: SearchAuthAdminService,
  ) {}

  @Get('search')
  @ApiOkResponse({
    description: 'Search for a navigation item',
    type: SearchNavAuthAdminObj,
  })
  async search(
    @Query() query: SearchNavAuthAdminQuery,
    @CurrentUser() user: User,
  ): Promise<SearchNavAuthAdminObj> {
    return await this.searchService.search({ query, user });
  }

  @Get()
  @ApiOkResponse({
    type: ShowAuthAdminObj,
    description: 'Show the admin user with personal information',
  })
  async show(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ShowAuthAdminObj> {
    return await this.showService.show({ req, res });
  }
}
