import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ShowAuthSettingsAdminObj {
  @ApiProperty()
  @IsBoolean()
  force_login: boolean;

  @ApiProperty()
  @IsBoolean()
  lock_register: boolean;

  @ApiProperty()
  @IsBoolean()
  require_confirm_email: boolean;
}
