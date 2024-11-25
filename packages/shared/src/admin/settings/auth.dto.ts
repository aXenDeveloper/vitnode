import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsString } from 'class-validator';

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

export class ShowMethodAuthSettingsAdmin {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty()
  @IsString()
  name: string;
}

export class ShowMethodAuthSettingsAdminObj {
  @ApiProperty({ type: [ShowMethodAuthSettingsAdmin] })
  @IsArray()
  edges: ShowMethodAuthSettingsAdmin[];
}
