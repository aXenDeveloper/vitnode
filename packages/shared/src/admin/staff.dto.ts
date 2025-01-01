import { ApiProperty } from '@nestjs/swagger';

export class PermissionsStaff {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: [String] })
  permissions: string[];
}

export class PermissionsStaffArgs {
  @ApiProperty({ type: [PermissionsStaff] })
  groups: PermissionsStaff[];

  @ApiProperty()
  plugin_code: string;
}

export class PermissionsStaffObj {
  @ApiProperty({ type: [PermissionsStaff] })
  groups: PermissionsStaff[];

  @ApiProperty()
  plugin: string;

  @ApiProperty()
  plugin_code: string;
}
