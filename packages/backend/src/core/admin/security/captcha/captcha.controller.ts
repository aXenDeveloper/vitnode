import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ShowCaptchaSecurityAdminObj } from 'vitnode-shared/admin/security/captcha.dto';

import { EditCaptchaSecurityAdminService } from './service/edit.service';
import { ShowCaptchaSecurityAdminService } from './service/show.service';

@ApiSecurity('admin')
@ApiTags('Admin')
@Controller('admin/security/captcha')
@UseGuards(AdminAuthGuard)
export class CaptchaSecurityAdminController {
  constructor(
    private readonly showService: ShowCaptchaSecurityAdminService,
    private readonly editService: EditCaptchaSecurityAdminService,
  ) {}

  @ApiOkResponse({
    description: 'Edit captcha settings',
    type: ShowCaptchaSecurityAdminObj,
  })
  @Put()
  async edit(
    @Body() body: ShowCaptchaSecurityAdminObj,
  ): Promise<ShowCaptchaSecurityAdminObj> {
    return await this.editService.edit(body);
  }

  @ApiOkResponse({
    description: 'Show captcha settings',
    type: ShowCaptchaSecurityAdminObj,
  })
  @Get()
  async show(): Promise<ShowCaptchaSecurityAdminObj> {
    return await this.showService.show();
  }
}
