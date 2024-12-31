import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import { AuthGuard } from '@/guards/auth.guard';
import { OnlyForDevelopment } from '@/guards/dev.guard';
import { applyDecorators, Controller, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';

interface Args {
  isDev?: boolean;
  plugin_code: string;
  plugin_name: string;
  route?: string;
}

interface ArgsWithAdmin extends Args {
  isAdmin: true;
  isProtect?: never;
}

interface ArgsWithout extends Args {
  isAdmin?: never;
  isProtect?: never;
}

interface ArgsWithProtect extends Args {
  isAdmin?: never;
  isProtect: true;
}

export const Controllers = ({
  plugin_name,
  plugin_code,
  isAdmin,
  isProtect,
  route,
  isDev,
}: ArgsWithAdmin | ArgsWithout | ArgsWithProtect) => {
  const decorators = [Controller(`${plugin_code}${route ? `/${route}` : ''}`)];

  if (isDev) {
    decorators.push(UseGuards(OnlyForDevelopment));
  }

  if (isAdmin) {
    decorators.push(
      ApiTags(`Admin - ${plugin_name}`),
      ApiSecurity('admin'),
      UseGuards(AdminAuthGuard),
      Controller(`admin/${plugin_code}${route ? `/${route}` : ''}`),
    );
  } else {
    decorators.push(ApiTags(plugin_name));
  }

  if (isProtect) {
    decorators.push(ApiSecurity(''), UseGuards(AuthGuard));
  }

  return applyDecorators(...decorators);
};
