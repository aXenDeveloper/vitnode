import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum } from 'class-validator';

import { AllowTypeFilesEnum } from '../../utils/global';

class FilesEditorStylesAdmin {
  @ApiProperty({ enum: AllowTypeFilesEnum })
  @IsEnum(AllowTypeFilesEnum)
  allow_type: AllowTypeFilesEnum;
}

export class EditorStylesAdminBody {
  @ApiProperty()
  files: FilesEditorStylesAdmin;

  @ApiProperty()
  @IsBoolean()
  sticky: boolean;
}
