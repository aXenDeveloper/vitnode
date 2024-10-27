import { UserWithDangerousInfo } from '@/user.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PermissionsStaffObjWithoutPluginName } from './staff.dto';

export class ItemNavAuthAdminObj {
  @ApiProperty()
  code: string;

  @ApiPropertyOptional()
  icon?: string;

  @ApiProperty({ type: [String] })
  keywords: string[];
}

export class ParentNavAuthAdminObj extends ItemNavAuthAdminObj {
  @ApiProperty({ type: [ItemNavAuthAdminObj] })
  children?: ItemNavAuthAdminObj[];
}

export class NavAuthAdminObj {
  @ApiProperty()
  code: string;

  @ApiProperty({ type: [ParentNavAuthAdminObj] })
  nav: ParentNavAuthAdminObj[];
}

export class ShowAuthAdminObj {
  @ApiProperty({ type: [NavAuthAdminObj] })
  nav: NavAuthAdminObj[];

  @ApiProperty({ type: [PermissionsStaffObjWithoutPluginName] })
  permissions: PermissionsStaffObjWithoutPluginName[];

  @ApiProperty()
  restart_server: boolean;

  @ApiProperty()
  user: UserWithDangerousInfo;

  @ApiProperty()
  version_of_vitnode: string;
}
