import { ApiProperty } from '@nestjs/swagger';

import { StringLanguage } from './string-language.dto';

export class ItemShowNavStyles {
  @ApiProperty({ type: [StringLanguage] })
  description: StringLanguage[];

  @ApiProperty()
  external: boolean;

  @ApiProperty()
  href: string;

  @ApiProperty()
  id: number;

  @ApiProperty()
  last_updated: Date;

  @ApiProperty({ type: [StringLanguage] })
  name: StringLanguage[];

  @ApiProperty()
  position: number;
}

export class ShowNavStyles extends ItemShowNavStyles {
  @ApiProperty({ type: [ItemShowNavStyles] })
  children: ItemShowNavStyles[];
}
