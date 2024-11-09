import { ApiProperty } from '@nestjs/swagger';

export class ShowDevicesSettingsAuthObj {
  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  expires_at: Date;

  @ApiProperty()
  id: number;

  @ApiProperty()
  ip_address: string;

  @ApiProperty()
  last_seen: Date;

  @ApiProperty()
  login_token: string;

  @ApiProperty()
  uagent_browser: string;

  @ApiProperty()
  uagent_os: string;

  @ApiProperty()
  uagent_version: string;
}
