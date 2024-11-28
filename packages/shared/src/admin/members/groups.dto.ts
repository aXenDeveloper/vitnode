import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

import { StringLanguage } from '../../string-language.dto';
import { GroupUser } from '../../user.dto';
import { PaginationObj, PaginationQuery } from '../../utils/pagination.dto';
import { SortDirectionEnum } from '../../utils/pagination.enum';
import { TransformStringLanguageInput } from '../../utils/text-language';
import { GroupsMembersAdminSortEnum } from './groups.enum';

class ContentCreateGroupsMembersAdmin {
  @ApiProperty()
  @IsBoolean()
  files_allow_upload: boolean;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  files_max_storage_for_submit: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  files_total_max_storage: number;
}

export class ContentGroupMembersAdmin {
  @ApiProperty()
  files_allow_upload: boolean;

  @ApiProperty()
  files_max_storage_for_submit: number;

  @ApiProperty()
  files_total_max_storage: number;
}

export class CreateGroupsMembersAdminBody {
  @ApiPropertyOptional()
  @IsString()
  color?: string;

  @ApiProperty()
  @Type(() => ContentCreateGroupsMembersAdmin)
  @ValidateNested()
  content: ContentCreateGroupsMembersAdmin;

  @ApiProperty({ type: [StringLanguage] })
  @ArrayMinSize(1)
  @Transform(TransformStringLanguageInput)
  name: StringLanguage[];
}

export class GroupMembersAdmin extends GroupUser {
  @ApiProperty()
  content: ContentGroupMembersAdmin;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  default: boolean;

  @ApiProperty()
  guest: boolean;

  @ApiProperty()
  protected: boolean;

  @ApiProperty()
  root: boolean;

  @ApiProperty()
  updated_at: Date;

  @ApiProperty()
  users_count: number;
}

export class GroupsMembersAdminObj extends PaginationObj {
  @ApiProperty({ type: [GroupMembersAdmin] })
  edges: GroupMembersAdmin[];
}

export class GroupsMembersAdminQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: GroupsMembersAdminSortEnum,
  })
  @IsEnum(GroupsMembersAdminSortEnum)
  @IsOptional()
  sortBy?: GroupsMembersAdminSortEnum;

  @ApiPropertyOptional({ enum: SortDirectionEnum })
  @IsEnum(SortDirectionEnum)
  @IsOptional()
  sortDirection?: SortDirectionEnum;
}
