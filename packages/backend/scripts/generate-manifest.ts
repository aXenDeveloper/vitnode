import { existsSync } from 'fs';
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
/* eslint-disable no-console */
import { join } from 'path';

import { objectToArray, updateObject } from './helpers/update-object';

interface ManifestType {
  background_color?: string;
  description?: string;
  display?: 'browser' | 'fullscreen' | 'minimal-ui' | 'standalone';
  display_override?: (
    | 'browser'
    | 'fullscreen'
    | 'minimal-ui'
    | 'standalone'
    | 'window-controls-overlay'
  )[];
  icons?: {
    purpose?: 'any' | 'badge' | 'maskable' | 'monochrome';
    sizes?: string;
    src: string;
    type?: string;
  }[];
  id?: string;
  lang?: string;
  name?: string;
  orientation?:
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
  short_name?: string;
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
  start_url?: string;
  theme_color?: string;
}

const generateDefaultManifest = ({
  langCode,
  frontendUrl,
  siteName,
  siteShortName,
}): ManifestType => ({
  id: `${frontendUrl}/${langCode}/`,
  name: siteName,
  short_name: siteShortName,
  lang: langCode,
  description: '',
  display: 'standalone',
  theme_color: '#2463eb',
  background_color: '#09090b',
  start_url: `${frontendUrl}/${langCode}/`,
  orientation: 'any',
  icons: [
    {
      src: '/icons/favicon.ico',
      sizes: 'any',
      type: 'image/x-icon',
    },
  ],
});

export const generateManifest = async () => {
  const langsPath = join(
    process.cwd(),
    '..',
    'frontend',
    'src',
    'plugins',
    'core',
    'langs',
  );

  if (!existsSync(langsPath)) {
    console.log(
      `⛔️ Languages not found in 'frontend/plugins/core/langs' directory. "${langsPath}"`,
    );
    process.exit(1);
  }

  const configPath = join(
    process.cwd(),
    'src',
    'plugins',
    'core',
    'utils',
    'config.json',
  );

  if (!existsSync(configPath)) {
    console.log(
      `⛔️ Config file not found in 'backend/utils/config.json' directory. "${configPath}"`,
    );
    process.exit(1);
  }

  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const languages = (await readdir(langsPath)).map(fileName =>
    fileName.replace('.json', ''),
  );

  const envUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;
  const frontendUrl = envUrl ? envUrl : 'http://localhost:3000';

  await Promise.all(
    languages.map(async langCode => {
      const defaultManifest = generateDefaultManifest({
        langCode,
        frontendUrl,
        siteName: config.settings.main.site_name,
        siteShortName: config.settings.main.site_short_name,
      });

      const pathToUpload = join(
        process.cwd(),
        'uploads',
        'public',
        'assets',
        langCode,
      );
      const pathToUploadFile = join(pathToUpload, 'manifest.webmanifest');

      if (!existsSync(pathToUpload)) {
        await mkdir(pathToUpload, { recursive: true });

        await writeFile(
          pathToUploadFile,
          JSON.stringify(defaultManifest, null, 2),
        );

        return;
      }

      // Update manifest
      const manifest: ManifestType = JSON.parse(
        await readFile(pathToUploadFile, 'utf8'),
      );
      if (!manifest.start_url) return;
      const startUrl = `${frontendUrl}/${langCode}`;
      const updatedManifest: ManifestType = objectToArray(
        updateObject(
          {
            ...manifest,
            start_url: `${startUrl}${manifest.start_url.replace(startUrl, '')}`,
            id: `${startUrl}${manifest.start_url.replace(startUrl, '')}`,
          },
          defaultManifest,
        ),
      );

      await writeFile(
        pathToUploadFile,
        JSON.stringify(updatedManifest, null, 2),
      );
    }),
  );
};
