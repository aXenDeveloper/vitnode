import { ApiProperty, OmitType } from '@nestjs/swagger';

class PermissionsStaffInput {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: [String] })
  permissions: string[];
}

export class PermissionsStaffArgs {
  @ApiProperty({ type: [PermissionsStaffInput] })
  groups: PermissionsStaffInput[];

  @ApiProperty()
  plugin_code: string;
}

export class PermissionsStaff {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: [String] })
  permissions: string[];
}

export class PermissionsStaffObj {
  @ApiProperty({ type: [PermissionsStaff] })
  groups: PermissionsStaff[];

  @ApiProperty()
  plugin: string;

  @ApiProperty()
  plugin_code: string;
}

export class PermissionsStaffObjWithoutPluginName extends OmitType(
  PermissionsStaffObj,
  ['plugin'] as const,
) {}
