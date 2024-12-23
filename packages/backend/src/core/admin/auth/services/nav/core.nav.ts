import { ShowAuthAdminObj } from 'vitnode-shared/admin/auth.dto';

export const coreNav: ShowAuthAdminObj['nav'] = [
  {
    code: 'core',
    nav: [
      {
        code: 'dashboard',
        icon: 'layout-dashboard',
        keywords: [],
      },
      {
        code: 'settings',
        icon: 'settings',
        keywords: [],
        children: [
          {
            code: 'main',
            keywords: ['name', 'title', 'description', 'desc'],
          },
          {
            code: 'metadata',
            keywords: [
              'manifest',
              'pwa',
              'seo',
              'icon',
              'favicon',
              'theme',
              'color',
              'start',
            ],
          },
          {
            code: 'email',
            keywords: ['email', 'e-mail', 'mail', 'smtp'],
          },
          {
            code: 'authorization',
            keywords: [
              'authorization',
              'auth',
              'login',
              'register',
              'force login',
              'sign in',
              'sign up',
            ],
          },
          {
            code: 'legal',
            keywords: ['legal', 'terms', 'privacy', 'policy', 'tos', 'pp'],
          },
        ],
      },
      {
        code: 'styles',
        icon: 'paintbrush',
        keywords: [],
        children: [
          {
            code: 'nav',
            keywords: ['nav', 'navigation'],
          },
          {
            code: 'editor',
            keywords: ['editor', 'tiptap'],
          },
          {
            code: 'theme-editor',
            keywords: ['theme', 'editor', 'color', 'logo'],
          },
        ],
      },
      {
        code: 'plugins',
        icon: 'plug',
        keywords: ['plug', 'plugin'],
      },
      {
        code: 'langs',
        icon: 'languages',
        keywords: ['language'],
      },
      {
        code: 'advanced',
        icon: 'cog',
        keywords: [],
        children: [
          {
            code: 'files',
            keywords: ['file'],
          },
        ],
      },
    ],
  },
  {
    code: 'members',
    nav: [
      {
        code: 'users',
        icon: 'users',
        keywords: ['user'],
      },
      {
        code: 'groups',
        icon: 'group',
        keywords: ['group', 'permission', 'file', 'upload', 'storage'],
      },
      {
        code: 'staff',
        icon: 'user-cog',
        keywords: [],
        children: [
          {
            code: 'admin',
            keywords: ['admin', 'administrator'],
          },
        ],
      },
    ],
  },
];
