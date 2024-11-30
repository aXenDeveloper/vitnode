import { ABSOLUTE_PATHS } from '@/app.module';
import { NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { ManifestDisplay } from 'vitnode-shared/admin/settings/metadata.enum';
import { FileObj } from 'vitnode-shared/utils/files.dto';

export interface ManifestType {
  background_color: string;
  description?: string;
  display: ManifestDisplay;
  display_override?: (
    | 'browser'
    | 'fullscreen'
    | 'minimal-ui'
    | 'standalone'
    | 'window-controls-overlay'
  )[];
  icons?: (FileObj & {
    purpose?: 'any' | 'badge' | 'maskable' | 'monochrome';
    sizes?: string;
    src: string;
    type?: string;
  })[];
  id: string;
  lang: string;
  name: string;
  orientation:
    | 'any'
    | 'landscape'
    | 'landscape-primary'
    | 'landscape-secondary'
    | 'natural'
    | 'portrait'
    | 'portrait-primary'
    | 'portrait-secondary';
  screenshots?: {
    sizes?: string;
    src: string;
    type?: string;
  }[];
  short_name: string;
  shortcuts?: {
    description?: string;
    icons?: {
      purpose?: 'any' | 'badge' | 'maskable' | 'monochrome';
      sizes?: string;
      src: string;
      type?: string;
    }[];
    name: string;
    short_name?: string;
    url: string;
  }[];
  start_url: string;
  theme_color: string;
}

export const getManifest = async ({
  lang_code,
}: {
  lang_code: string;
}): Promise<ManifestType> => {
  const path = join(
    ABSOLUTE_PATHS.uploads.public,
    'assets',
    lang_code,
    'manifest.webmanifest',
  );

  if (!existsSync(path)) {
    throw new NotFoundException('MANIFEST_NOT_FOUND');
  }

  const file = await readFile(path, 'utf8');
  const data: ManifestType = JSON.parse(file);

  return data;
};
