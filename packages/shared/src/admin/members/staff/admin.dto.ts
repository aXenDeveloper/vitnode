import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
  OmitType,
} from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional } from 'class-validator';

import { StringLanguage } from '../../../string-language.dto';
import { GroupUser, User } from '../../../user.dto';
import { PageInfoObj, PaginationQuery } from '../../../utils/pagination.dto';
import {
  PermissionsStaffArgs,
  PermissionsStaffObj,
  PermissionsStaffObjWithoutPluginName,
} from '../../staff.dto';

export class CreateAdminStaffMembersAdminBody {
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  group_id: null | number;

  @ApiProperty({ type: [PermissionsStaffArgs] })
  @IsArray()
  permissions: PermissionsStaffArgs[];

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  user_id: null | number;
}

export class EditAdminStaffMembersAdminBody extends OmitType(
  CreateAdminStaffMembersAdminBody,
  ['group_id', 'user_id'] as const,
) {}

export class AdminStaffMembersAdminQuery extends PaginationQuery {}

export class StaffGroupUser extends OmitType(GroupUser, ['name'] as const) {
  @ApiProperty({ type: [StringLanguage] })
  group_name: StringLanguage[];
}

export class AdminStaffMembersAdmin {
  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  id: number;

  @ApiProperty({ type: [PermissionsStaffObjWithoutPluginName] })
  permissions: PermissionsStaffObjWithoutPluginName[];

  @ApiProperty()
  protected: boolean;

  @ApiProperty()
  updated_at: Date;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(User) },
      { $ref: getSchemaPath(StaffGroupUser) },
    ],
  })
  user_or_group: StaffGroupUser | User;
}

export class AdminStaffMembersAdminObj extends PageInfoObj {
  @ApiProperty({ type: [AdminStaffMembersAdmin] })
  edges: AdminStaffMembersAdmin[];

  @ApiProperty({ type: [PermissionsStaffObj] })
  permissions: PermissionsStaffObj[];
}
