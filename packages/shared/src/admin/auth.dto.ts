import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { UserWithDangerousInfo } from '../user.dto';
import { PermissionsStaffObjWithoutPluginName } from './staff.dto';

export class ItemNavAuthAdminObj {
  @ApiProperty()
  code: string;

  @ApiPropertyOptional()
  icon?: string;

  @ApiProperty({ type: [String] })
  keywords: string[];
}

export class NavAuthAdminObj {
  @ApiProperty()
  code: string;

  @ApiProperty({ type: [ParentNavAuthAdminObj] })
  nav: ParentNavAuthAdminObj[];
}

export class NavSearchNavAuthAdmin extends ItemNavAuthAdminObj {
  @ApiProperty()
  code_plugin: string;

  @ApiPropertyOptional()
  parent_nav_code?: string;
}

export class ParentNavAuthAdminObj extends ItemNavAuthAdminObj {
  @ApiProperty({ type: [ItemNavAuthAdminObj] })
  children?: ItemNavAuthAdminObj[];
}

export class SearchNavAuthAdminObj {
  @ApiProperty({ type: [NavSearchNavAuthAdmin] })
  nav: NavSearchNavAuthAdmin[];
}

export class SearchNavAuthAdminQuery {
  @ApiProperty()
  @IsOptional()
  @IsString()
  search?: string;
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
