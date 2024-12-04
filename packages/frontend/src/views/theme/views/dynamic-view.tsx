import { TranslationsProvider } from '@/components/translations-provider';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ForgotPasswordView } from './auth/sign/forgot_password/forgot_password-view';
import {
  generateMetadataSignIn,
  SignInView,
} from './auth/sign/in/sign-in-view';
import { CallbackSSOAuthView } from './auth/sign/sso/callback/callback-sso-auth-view';
import { UrlSSOAuthView } from './auth/sign/sso/url-sso-auth-view';
import { ConfirmEmailSignUpView } from './auth/sign/up/confirm-email/confirm-email-sign-up-view';
import {
  generateMetadataSignUp,
  SignUpView,
} from './auth/sign/up/sign-up-view';
import {
  generateMetadataItemLegal,
  ItemLegalView,
} from './legal/item/item-legal-view';
import { generateMetadataLegal, LegalView } from './legal/legal-view';
import { LayoutSettingsView } from './settings/layout';
import {
  DevicesSettingsView,
  generateMetadataDevicesSettings,
} from './settings/views/devices/devices-settings-view';
import {
  FilesSettingsView,
  generateMetadataFilesSettings,
} from './settings/views/files/files-settings-view';
import { OverviewSettingsView } from './settings/views/overview/overview-settings-view';

export const generateMetadataDynamic = async (props: {
  params: Promise<{
    slug: string[];
  }>;
}): Promise<Metadata> => {
  const { slug } = await props.params;

  if (slug[0] === 'login' && !slug[2]) {
    if (slug[1] === 'forgot-password') {
      const t = await getTranslations('core.sign_in.forgot_password');

      return {
        title: t('title'),
      };
    }

    if (!slug[1]) {
      return generateMetadataSignIn();
    }
  }

  if (slug[0] === 'register') {
    return generateMetadataSignUp();
  }

  if (slug[0] === 'legal' && !slug[2]) {
    if (!slug[1]) return generateMetadataLegal();
    if (slug[1]) return generateMetadataItemLegal({ code: slug[1] });
  }

  if (slug[0] === 'settings' && !slug[2]) {
    const t = await getTranslations('core.settings');
    const primary: Metadata = {
      title: t('title'),
      robots: 'noindex, nofollow',
    };

    if (slug[1] === 'files' && !slug[2]) {
      const current = await generateMetadataFilesSettings();

      return {
        ...primary,
        ...current,
        title: `${current.title} - ${primary.title}`,
      };
    }
    if (slug[1] === 'devices' && !slug[2]) {
      const current = await generateMetadataDevicesSettings();

      return {
        ...primary,
        ...current,
        title: `${current.title} - ${primary.title}`,
      };
    }

    return primary;
  }

  return {};
};

export const DynamicView = async (props: {
  params: Promise<{
    slug: string[];
  }>;
  searchParams: Promise<Record<string, string>>;
}) => {
  const { slug } = await props.params;
  if (slug[0] === 'login' && !slug[4]) {
    if (slug[1] === 'sso' && slug[2]) {
      if (slug[3] === 'callback') {
        const code = (await props.searchParams).code;

        return (
          <TranslationsProvider
            namespaces={['core.sign_in.sso_first_login', 'core.sign_up']}
          >
            <CallbackSSOAuthView code={code} provider={slug[2]} />
          </TranslationsProvider>
        );
      }

      if (slug[3]) notFound();

      return <UrlSSOAuthView provider={slug[2]} />;
    }

    if (slug[1] === 'forgot-password' && !slug[2]) {
      const { userId, token } = await props.searchParams;

      return <ForgotPasswordView token={token} userId={userId} />;
    }

    if (slug[1]) notFound();

    return (
      <TranslationsProvider namespaces="core.sign_in">
        <SignInView />
      </TranslationsProvider>
    );
  }

  if (slug[0] === 'register') {
    return (
      <TranslationsProvider namespaces="core.sign_up">
        {(() => {
          if (!slug[1]) {
            return <SignUpView />;
          }

          if (slug[1] === 'confirm-email') {
            return <ConfirmEmailSignUpView {...props} />;
          }

          notFound();
        })()}
      </TranslationsProvider>
    );
  }

  if (slug[0] === 'legal' && !slug[2]) {
    if (!slug[1]) return <LegalView />;
    if (slug[1]) {
      return <ItemLegalView code={slug[1]} />;
    }
  }

  if (slug[0] === 'settings' && !slug[2]) {
    return (
      <LayoutSettingsView>
        {(() => {
          if (!slug[1] && !slug[2]) {
            return <OverviewSettingsView />;
          }

          if (slug[1] === 'files' && !slug[2]) {
            return <FilesSettingsView {...props} />;
          }

          if (slug[1] === 'devices' && !slug[2]) {
            return <DevicesSettingsView />;
          }

          notFound();
        })()}
      </LayoutSettingsView>
    );
  }

  return notFound();
};
