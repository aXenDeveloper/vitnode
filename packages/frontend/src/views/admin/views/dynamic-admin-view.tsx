import { TranslationsProvider } from '@/components/translations-provider';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import {
  FilesAdvancedCoreAdminView,
  generateMetadataFilesAdvancedCoreAdmin,
} from './core/advanced/files/files-advanced-core-admin-view';
import { DashboardCoreAdminView } from './core/dashboard/dashboard-core-admin-view';
import {
  DiagnosticToolsView,
  generateMetadataDiagnosticAdmin,
} from './core/diagnostic/diagnostic-tools-view';
import {
  generateMetadataLangsCoreAdmin,
  LangsCoreAdminView,
} from './core/langs/langs-core-admin-view';
import {
  DevPluginAdminLayout,
  generateMetadataDevPluginAdminLayout,
} from './core/plugins/dev/layout';
import { NavDevPluginAdminView } from './core/plugins/dev/nav/nav';
import { OverviewDevPluginAdminView } from './core/plugins/dev/overview';
import { PermissionsAdminDevPluginAdminView } from './core/plugins/dev/permissions-admin/permissions-admin';
import {
  generateMetadataPluginsAdmin,
  PluginsAdminView,
} from './core/plugins/plugins-admin-view';
import {
  CaptchaSpamSecurityAdminView,
  generateMetadataCaptchaSpamSecurityAdmin,
} from './core/security/spam/captcha/captcha-spam-security-admin-view';
import { SpamSecurityAdminLayout } from './core/security/spam/layout';
import {
  EmailSettingsAdminView,
  generateMetadataEmailSettingsAdmin,
} from './core/settings/email/email-settings-admin-view';
import {
  generateMetadataLogsEmailSettingsAdmin,
  LogsEmailSettingsAdminView,
} from './core/settings/email/logs/logs-email-settings-admin-view';
import {
  generateMetadataLegalSettingsAdmin,
  LegalSettingsAdminView,
} from './core/settings/legal/legal-core-admin-view';
import {
  generateMetadataMainSettingsCoreAdmin,
  MainSettingsCoreAdminView,
} from './core/settings/main/main-settings-core-admin-view';
import {
  EditorStylesAdminView,
  generateMetadataEditorStylesAdmin,
} from './core/styles/editor/editor-admin-view';
import {
  generateMetadataNavStyleAdmin,
  NavStyleAdminView,
} from './core/styles/nav/nav-admin-view';
import {
  generateMetadataGroupsMembersAdmin,
  GroupsMembersAdminView,
} from './members/groups/groups-members-admin-view';
import {
  AdminStaffAdminView,
  generateMetadataAdminStaffAdmin,
} from './members/staff/admin/admin-view';
import {
  generateMetadataUserMembersAdmin,
  UserMembersAdminView,
} from './members/user/user-members-admin-view';
import {
  generateMetadataUsersMembersAdmin,
  UsersMembersAdminView,
} from './members/users/users-members-admin-view';

export const generateMetadataDynamic = async (props: {
  params: Promise<{
    slug: string[];
  }>;
}): Promise<Metadata> => {
  const { slug } = await props.params;

  if (slug[0] === 'core') {
    if (slug[1] === 'diagnostic' && !slug[2]) {
      return generateMetadataDiagnosticAdmin();
    }

    if (slug[1] === 'langs' && !slug[2]) {
      return generateMetadataLangsCoreAdmin();
    }

    if (slug[1] === 'settings') {
      if (slug[2] === 'email' && !slug[4]) {
        if (!slug[3]) {
          return generateMetadataEmailSettingsAdmin();
        }

        if (slug[3] === 'logs') {
          return generateMetadataLogsEmailSettingsAdmin();
        }
      }

      if (slug[2] === 'legal' && !slug[3]) {
        return generateMetadataLegalSettingsAdmin();
      }

      if (slug[2] === 'main' && !slug[3]) {
        return generateMetadataMainSettingsCoreAdmin();
      }
    }

    if (slug[1] === 'styles' && !slug[3]) {
      if (slug[2] === 'editor') {
        return generateMetadataEditorStylesAdmin();
      }

      if (slug[2] === 'nav') {
        return generateMetadataNavStyleAdmin();
      }
    }

    if (slug[1] === 'advanced' && !slug[3]) {
      if (slug[2] === 'files') {
        return generateMetadataFilesAdvancedCoreAdmin();
      }
    }

    if (slug[1] === 'security' && !slug[4]) {
      const t = await getTranslations('admin.core.security.spam');
      const primary: Metadata = {
        title: t('title'),
      };

      if (slug[2] === 'spam') {
        const current = await generateMetadataCaptchaSpamSecurityAdmin();

        return {
          ...primary,
          ...current,
          title: `${current.title} - ${primary.title}`,
        };
      }
    }

    if (slug[1] === 'plugins' && !slug[5]) {
      if (!slug[2]) {
        return generateMetadataPluginsAdmin();
      }

      if (slug[2] && slug[3] === 'dev') {
        return generateMetadataDevPluginAdminLayout({
          code: slug[2],
        });
      }
    }
  }

  if (slug[0] === 'members') {
    if (slug[1] === 'groups' && !slug[2]) {
      return generateMetadataGroupsMembersAdmin();
    }

    if (slug[1] === 'users' && !slug[3]) {
      if (!slug[2]) {
        return generateMetadataUsersMembersAdmin();
      }

      return generateMetadataUserMembersAdmin({ id: slug[2] });
    }

    if (slug[1] === 'staff' && !slug[3]) {
      if (slug[2] === 'admin') {
        return generateMetadataAdminStaffAdmin();
      }
    }
  }

  return {};
};

export const DynamicAdminView = async (props: {
  params: Promise<{
    slug: string[];
  }>;
  searchParams: Promise<Record<string, string>>;
}) => {
  const { slug } = await props.params;

  if (slug[0] === 'core') {
    if (slug[1] === 'dashboard' && !slug[2]) {
      return <DashboardCoreAdminView />;
    }

    if (slug[1] === 'diagnostic' && !slug[2]) {
      return <DiagnosticToolsView />;
    }

    if (slug[1] === 'langs' && !slug[2]) {
      return <LangsCoreAdminView {...props} />;
    }

    if (slug[1] === 'settings') {
      if (slug[2] === 'email' && !slug[4]) {
        return (
          <TranslationsProvider namespaces="admin.core.settings.email">
            {(() => {
              if (!slug[3]) {
                return <EmailSettingsAdminView />;
              }

              if (slug[3] === 'logs') {
                return <LogsEmailSettingsAdminView {...props} />;
              }

              notFound();
            })()}
          </TranslationsProvider>
        );
      }

      if (slug[2] === 'legal' && !slug[3]) {
        return <LegalSettingsAdminView {...props} />;
      }

      if (slug[2] === 'main' && !slug[3]) {
        return <MainSettingsCoreAdminView />;
      }

      notFound();
    }

    if (slug[1] === 'styles' && !slug[3]) {
      if (slug[2] === 'editor') {
        return <EditorStylesAdminView />;
      }

      if (slug[2] === 'nav') {
        return <NavStyleAdminView />;
      }

      notFound();
    }

    if (slug[1] === 'advanced' && !slug[3]) {
      if (slug[2] === 'files') {
        return <FilesAdvancedCoreAdminView {...props} />;
      }
    }

    if (slug[1] === 'security' && !slug[4]) {
      if (slug[2] === 'spam') {
        return (
          <SpamSecurityAdminLayout>
            {(() => {
              if (slug[3] === 'captcha' || !slug[3]) {
                return <CaptchaSpamSecurityAdminView />;
              }

              notFound();
            })()}
          </SpamSecurityAdminLayout>
        );
      }

      notFound();
    }

    if (slug[1] === 'plugins' && !slug[5]) {
      return (
        <TranslationsProvider namespaces="admin.core.plugins">
          {(() => {
            if (!slug[2]) {
              return <PluginsAdminView {...props} />;
            }

            if (slug[2] && slug[3] === 'dev') {
              return (
                <DevPluginAdminLayout code={slug[2]}>
                  {(() => {
                    if (!slug[4]) {
                      return <OverviewDevPluginAdminView code={slug[2]} />;
                    }

                    if (slug[4] === 'nav') {
                      return <NavDevPluginAdminView code={slug[2]} />;
                    }

                    if (slug[4] === 'permissions-admin') {
                      return (
                        <PermissionsAdminDevPluginAdminView code={slug[2]} />
                      );
                    }

                    notFound();
                  })()}
                </DevPluginAdminLayout>
              );
            }

            notFound();
          })()}
        </TranslationsProvider>
      );
    }

    notFound();
  }

  if (slug[0] === 'members') {
    if (slug[1] === 'groups' && !slug[2]) {
      return <GroupsMembersAdminView {...props} />;
    }

    if (slug[1] === 'users' && !slug[3]) {
      return (
        <TranslationsProvider
          namespaces={['admin.members.users', 'core.sign_up']}
        >
          {(() => {
            if (!slug[2]) {
              return <UsersMembersAdminView {...props} />;
            }

            return <UserMembersAdminView id={slug[2]} />;
          })()}
        </TranslationsProvider>
      );
    }

    if (slug[1] === 'staff' && !slug[3]) {
      if (slug[2] === 'admin') {
        return <AdminStaffAdminView {...props} />;
      }
      notFound();
    }

    notFound();
  }

  notFound();
};
