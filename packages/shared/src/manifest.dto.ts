import { ApiProperty } from '@nestjs/swagger';

export interface ManifestWithLang extends ShowManifestObj {
  description: string;
}

export class ShowManifestObj {
  @ApiProperty()
  background_color: string;

  @ApiProperty()
  display: string;

  @ApiProperty()
  id: string;

  @ApiProperty()
  lang: string;

  @ApiProperty()
  start_url: string;

  @ApiProperty()
  theme_color: string;
}
