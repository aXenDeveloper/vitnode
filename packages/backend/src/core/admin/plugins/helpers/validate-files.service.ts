import { ABSOLUTE_PATHS } from '@/app.module';
import { BadRequestException, Injectable } from '@nestjs/common';
import { existsSync } from 'fs';

@Injectable()
export class ValidateFilesPluginsAdminHelpersService {
  validateFiles({ code }: { code: string }) {
    const pluginPath = ABSOLUTE_PATHS.plugin({ code });
    const pathsToFolders = [
      // Frontend - pages
      pluginPath.frontend.pages,
      pluginPath.frontend.pages_main,
      // Frontend - admin pages
      pluginPath.frontend.admin_pages,
      pluginPath.frontend.admin_pages_auth,
      // Frontend - plugin
      pluginPath.frontend.plugin,
      // Shared
      pluginPath.shared,
      // Backend
      pluginPath.root,
    ];

    // Check if the folders exist
    pathsToFolders.forEach(path => {
      if (existsSync(path)) {
        throw new BadRequestException(
          `CONFLICT_PLUGIN_CODE - ${path} Path already exists`,
        );
      }
    });
  }
}
