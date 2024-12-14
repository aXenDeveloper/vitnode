import { Controllers } from '@/helpers/controller.decorator';
import { Body, Get, Put } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import {
  EditNoteDashboardBody,
  NoteDashboard,
  ShowDashboardAdminObj,
} from 'vitnode-shared/admin/dashboard.dto';

import { EditNoteDashboardAdminService } from './services/edit-note.service';
import { ShowDashboardAdminService } from './services/show.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'dashboard',
  isAdmin: true,
})
export class DashboardAdminController {
  constructor(
    private readonly showService: ShowDashboardAdminService,
    private readonly editNoteService: EditNoteDashboardAdminService,
  ) {}

  @ApiOkResponse({
    type: NoteDashboard,
    description: 'Edit note',
  })
  @Put('edit-note')
  async editNote(@Body() body: EditNoteDashboardBody) {
    return await this.editNoteService.editNote(body);
  }

  @ApiOkResponse({
    type: ShowDashboardAdminObj,
    description: 'Show dashboard info',
  })
  @Get()
  async show() {
    return await this.showService.show();
  }
}
