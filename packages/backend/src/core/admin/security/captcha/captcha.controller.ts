import { Controllers } from '@/helpers/controller.decorator';
import { Body, Get, Put } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { ShowCaptchaSecurityAdminObj } from 'vitnode-shared/admin/security/captcha.dto';

import { EditCaptchaSecurityAdminService } from './service/edit.service';
import { ShowCaptchaSecurityAdminService } from './service/show.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'security',
  isAdmin: true,
  route: 'captcha',
})
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
