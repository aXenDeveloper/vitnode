import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { StringLanguage } from './string-language.dto';

export class AvatarUser {
  @ApiProperty()
  dir_folder: string;

  @ApiProperty()
  file_name: string;

  @ApiProperty()
  id: number;
}

export class FilesPermissionsCoreSessions {
  @ApiProperty()
  allow_upload: boolean;

  @ApiProperty()
  max_storage_for_submit: number;

  @ApiProperty()
  space_used: number;

  @ApiProperty()
  total_max_storage: number;
}

export class GroupUser {
  @ApiPropertyOptional()
  color: null | string;

  @ApiProperty()
  id: number;

  @ApiProperty({ type: [StringLanguage] })
  name: StringLanguage[];
}

export class User {
  @ApiPropertyOptional()
  avatar?: AvatarUser;

  @ApiProperty()
  avatar_color: string;

  @ApiProperty()
  group: GroupUser;

  @ApiProperty()
  id: number;

  @ApiProperty()
  language: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  name_seo: string;
}

export class UserWithDangerousInfo extends User {
  @ApiProperty()
  email: string;

  @ApiProperty()
  files_permissions: FilesPermissionsCoreSessions;

  @ApiProperty()
  is_admin: boolean;
}
