import { ConfigHelperService } from '@/helpers/config.service';
import { Injectable } from '@nestjs/common';
import {
  EditNoteDashboardBody,
  NoteDashboard,
} from 'vitnode-shared/admin/dashboard.dto';

@Injectable()
export class EditNoteDashboardAdminService {
  constructor(private readonly configHelper: ConfigHelperService) {}

  async editNote({ text }: EditNoteDashboardBody): Promise<NoteDashboard> {
    const data = await this.configHelper.updateConfig({
      admin_note: text,
      admin_note_updated_at: new Date(),
    });

    return {
      text: data.admin_note,
      updated_at: data.admin_note_updated_at,
    };
  }
}
