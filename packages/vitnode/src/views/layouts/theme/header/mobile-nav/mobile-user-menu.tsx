import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import {
  LanguagesIcon,
  LogOutIcon,
  PencilRulerIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { useStartEditWidgets } from "@/blocks/edit-widgets-context";
import { Avatar } from "@/components/avatar";
import { useLanguages } from "@/components/languages-provider";
import { NewTabIndicator } from "@/components/new-tab-indicator";
import { ThemeSegmentedControl } from "@/components/switchers/themes/theme-segmented-control";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";

import type { HeaderNavItem } from "../header-nav";
import type {
  UserHeaderState,
  UserHeaderUser,
} from "../user/user-header-model";

import {
  USER_HEADER_HREF,
  userHeaderMenu,
  userProfileHref,
} from "../user/user-header-model";
import {
  MobileNavLinks,
  mobileNavRowClassName,
  MobileNavSectionHeading,
} from "./mobile-nav-links";
import { MobileNavLink, useIsMobileNavHrefActive } from "./mobile-nav-parts";

export type MobileNavSignOut = () => Promise<void> | void;

const LanguageSelect = ({
  currentLocale,
  onSelectLocale,
}: {
  currentLocale: string;
  onSelectLocale: (locale: string) => void;
}) => {
  const t = useTranslations("core.global");
  const languages = useLanguages();
  const selectId = React.useId();

  if (languages.length <= 1) return null;

  return (
    <div className="flex min-h-11 items-center gap-3 ps-3">
      <LanguagesIcon
        aria-hidden
        className="text-muted-foreground size-5 shrink-0"
      />
      <label className="text-sm font-medium" htmlFor={selectId}>
        {t("language")}
      </label>
      <NativeSelect
        className="ms-auto w-auto max-w-44 min-w-0 flex-1 [&_select]:text-base [&_select]:sm:text-sm"
        id={selectId}
        onChange={event => {
          onSelectLocale(event.target.value);
        }}
        value={currentLocale}
      >
        {languages.map(({ code, name }) => (
          <NativeSelectOption key={code} value={code}>
            {name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
};

const Preferences = ({
  currentLocale,
  onSelectLocale,
}: {
  currentLocale: string;
  onSelectLocale: (locale: string) => void;
}) => {
  const t = useTranslations("core.global");

  return (
    <section
      aria-labelledby="mobile-nav-preferences"
      className="flex flex-col gap-2"
    >
      <MobileNavSectionHeading id="mobile-nav-preferences">
        {t("preferences")}
      </MobileNavSectionHeading>
      <div className="flex flex-col gap-2">
        <ThemeSegmentedControl />
        <LanguageSelect
          currentLocale={currentLocale}
          onSelectLocale={onSelectLocale}
        />
      </div>
    </section>
  );
};

const Identity = ({
  onNavigate,
  user,
}: {
  onNavigate: () => void;
  user: UserHeaderUser;
}) => (
  <MobileNavLink
    className="bg-muted/60 active:bg-accent mx-1 flex items-center gap-3 rounded-xl p-3 transition-colors duration-150"
    item={{ href: userProfileHref(user.nameCode) }}
    onNavigate={onNavigate}
  >
    <Avatar className="size-11" size={44} user={user} />
    <span className="grid min-w-0 flex-1 leading-tight">
      <span className="truncate font-medium">{user.name}</span>
      <span className="text-muted-foreground truncate text-sm">
        {user.email}
      </span>
    </span>
  </MobileNavLink>
);

const GuestActions = ({ onNavigate }: { onNavigate: () => void }) => {
  const t = useTranslations("core.global");

  return (
    <div className="grid grid-cols-2 gap-2 px-1">
      <Link
        className={buttonVariants({ size: "lg", variant: "outline" })}
        onClick={onNavigate}
        to={USER_HEADER_HREF.signIn}
      >
        {t("login")}
      </Link>
      <Link
        className={buttonVariants({ size: "lg" })}
        onClick={onNavigate}
        to={USER_HEADER_HREF.signUp}
      >
        {t("register")}
      </Link>
    </div>
  );
};

const EditWidgetsRow = ({ onNavigate }: { onNavigate: () => void }) => {
  const startEditWidgets = useStartEditWidgets();
  const t = useTranslations("core.global.user_bar");

  if (startEditWidgets === null) return null;

  return (
    <li>
      <button
        className={mobileNavRowClassName}
        onClick={() => {
          onNavigate();
          startEditWidgets();
        }}
        type="button"
      >
        <PencilRulerIcon aria-hidden className="text-muted-foreground size-5" />
        <span className="flex-1">{t("edit_widgets")}</span>
      </button>
    </li>
  );
};

const AccountLinks = ({
  onNavigate,
  user,
}: {
  onNavigate: () => void;
  user: UserHeaderUser;
}) => {
  const t = useTranslations("core.global.mobile_nav");
  const tUser = useTranslations("core.global.user_bar");
  const isActive = useIsMobileNavHrefActive();

  return (
    <section
      aria-labelledby="mobile-nav-account"
      className="flex flex-col gap-2"
    >
      <MobileNavSectionHeading id="mobile-nav-account">
        {t("account")}
      </MobileNavSectionHeading>
      <ul className="flex flex-col gap-0.5">
        <EditWidgetsRow onNavigate={onNavigate} />
        {userHeaderMenu(user)
          .flat()
          .map(({ href, Icon, key, newTab }) => (
            <li key={key}>
              <MobileNavLink
                aria-current={isActive(href) ? "page" : undefined}
                className={mobileNavRowClassName}
                item={{ href, isOpenInNewTab: newTab }}
                onNavigate={onNavigate}
              >
                <Icon aria-hidden className="text-muted-foreground size-5" />
                <span className="flex-1">{tUser(key)}</span>
                {newTab ? <NewTabIndicator /> : null}
              </MobileNavLink>
            </li>
          ))}
      </ul>
    </section>
  );
};

const SignOutRow = ({ onSignOut }: { onSignOut: () => void }) => {
  const t = useTranslations("core.global.user_bar");

  return (
    <button
      className={cn(mobileNavRowClassName, "text-destructive")}
      onClick={onSignOut}
      type="button"
    >
      <LogOutIcon aria-hidden className="size-5" />
      {t("log_out")}
    </button>
  );
};

export const MobileUserMenuContent = ({
  currentLocale,
  hasNavigation = true,
  navigation,
  onSelectLocale,
  onSignOut,
  state,
}: {
  currentLocale: string;
  hasNavigation?: boolean;
  navigation: HeaderNavItem[];
  onSelectLocale: (locale: string) => void;
  onSignOut: MobileNavSignOut;
  state: UserHeaderState;
}) => {
  const t = useTranslations("core.global");
  const [isOpen, setIsOpen] = React.useState(false);
  const close = () => {
    setIsOpen(false);
  };

  if (state.status === "loading") {
    return <Skeleton className="size-9 rounded-full" />;
  }

  return (
    <Drawer direction="right" onOpenChange={setIsOpen} open={isOpen}>
      <DrawerTrigger asChild>
        <Button
          aria-label={t("mobile_nav.menu")}
          className="relative before:absolute before:-inset-1"
          size="icon"
          variant="ghost"
        >
          {state.status === "authenticated" ? (
            <Avatar size={24} user={state.user} />
          ) : (
            <UserIcon />
          )}
        </Button>
      </DrawerTrigger>

      <DrawerContent aria-describedby={undefined} className="w-5/6">
        <div className="flex items-center justify-between gap-2 px-4 pt-[max(env(safe-area-inset-top),1rem)]">
          <DrawerTitle className="text-base font-semibold">
            {t("mobile_nav.menu")}
          </DrawerTitle>
          <DrawerClose asChild>
            <Button aria-label={t("close")} size="icon" variant="ghost">
              <XIcon />
            </Button>
          </DrawerClose>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-2 pt-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
          {state.status === "authenticated" ? (
            <Identity onNavigate={close} user={state.user} />
          ) : (
            <GuestActions onNavigate={close} />
          )}

          {hasNavigation ? (
            <MobileNavLinks navigation={navigation} onNavigate={close} />
          ) : null}

          {state.status === "authenticated" ? (
            <AccountLinks onNavigate={close} user={state.user} />
          ) : null}

          <Preferences
            currentLocale={currentLocale}
            onSelectLocale={onSelectLocale}
          />

          {state.status === "authenticated" ? (
            <SignOutRow
              onSignOut={() => {
                close();
                void onSignOut();
              }}
            />
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
