import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { StringLanguage } from './string-language.dto';

export class GroupUser {
  @ApiPropertyOptional()
  color: null | string;

  @ApiProperty()
  id: number;

  @ApiProperty()
  name: StringLanguage[];
}

export class User {
  // @ApiProperty()
  // avatar: AvatarUser | null;

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

export class UserWithDangerousInfo extends User {
  @ApiProperty()
  email: string;

  @ApiProperty()
  files_permissions: FilesPermissionsCoreSessions;
}
