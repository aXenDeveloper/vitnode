import { Reflector } from '@nestjs/core';

export interface AdminPermissionType {
  group: string;
  permission?: string;
  plugin_code: string;
}

export const AdminPermission = Reflector.createDecorator<AdminPermissionType>();
