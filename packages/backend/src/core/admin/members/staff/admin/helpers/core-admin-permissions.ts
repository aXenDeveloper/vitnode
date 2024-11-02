import { PermissionsStaffObj } from 'vitnode-shared/admin/staff.dto';

export const coreAdminPermissions: PermissionsStaffObj[] = [
  {
    plugin: 'Core',
    plugin_code: 'core',
    groups: [
      {
        id: 'dashboard',
        permissions: ['can_manage_diagnostic_tools'],
      },
      {
        id: 'settings',
        permissions: [
          'can_manage_settings_main',
          'can_manage_settings_security',
          'can_manage_settings_metadata',
          'can_manage_settings_email',
          'can_manage_settings_authorization',
          'can_manage_settings_legal',
          'can_manage_settings_ai',
        ],
      },
      {
        id: 'can_manage_plugins',
        permissions: [],
      },
      {
        id: 'styles',
        permissions: [
          'can_manage_styles_theme-editor',
          'can_manage_styles_nav',
          'can_manage_styles_editor',
        ],
      },
      {
        id: 'can_manage_langs',
        permissions: [],
      },
      {
        id: 'advanced',
        permissions: ['can_manage_advanced_files'],
      },
    ],
  },
  {
    plugin: 'Members',
    plugin_code: 'members',
    groups: [
      {
        id: 'users',
        permissions: ['can_manage_users'],
      },
      {
        id: 'can_manage_groups',
        permissions: [],
      },
      {
        id: 'staff',
        permissions: ['can_manage_staff_admin'],
      },
    ],
  },
];
