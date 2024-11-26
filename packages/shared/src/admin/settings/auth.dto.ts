import { ApiProperty, PickType } from '@nestjs/swagger';
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

export class CreateMethodAuthSettingsAdminBody {
  @ApiProperty()
  @IsString()
  client_id: string;

  @ApiProperty()
  @IsString()
  client_secret: string;

  @ApiProperty()
  @IsString()
  code: string;
}

export class EditMethodAuthSettingsAdminBody extends PickType(
  CreateMethodAuthSettingsAdminBody,
  ['client_id', 'client_secret'] as const,
) {
  @ApiProperty()
  @IsString()
  client_id: string;

  @ApiProperty()
  @IsString()
  client_secret: string;

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;
}

export class ShowMethodAuthSettingsAdmin extends CreateMethodAuthSettingsAdminBody {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty()
  @IsString()
  name: string;
}

export class EnabledMethodsAuthSettingsAdmin {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;
}

export class ShowMethodAuthSettingsAdminObj {
  @ApiProperty({ type: [ShowMethodAuthSettingsAdmin] })
  @IsArray()
  edges: ShowMethodAuthSettingsAdmin[];

  @ApiProperty({ type: [EnabledMethodsAuthSettingsAdmin] })
  @IsArray()
  enabledMethods: EnabledMethodsAuthSettingsAdmin[];
}
