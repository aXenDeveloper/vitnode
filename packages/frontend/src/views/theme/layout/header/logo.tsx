import { getMiddlewareData } from '@/api/get-middleware-data';
import { cn } from '@/helpers/classnames';
import { CONFIG } from '@/helpers/config-with-env';
import { Link } from '@/navigation';
import Image from 'next/image';

export const LogoHeader = async ({ className }: { className?: string }) => {
  const { logos } = await getMiddlewareData();

  return (
    <Link
      className="max-w-[75vw] truncate"
      href="/"
      id="vitnode_logo"
      style={
        {
          '--logo-width': `${logos.width}rem`,
          '--logo-mobile-width': `${logos.mobile_width}rem`,
        } as React.CSSProperties
      }
    >
      {!logos.logo_dark &&
      !logos.mobile_logo_dark &&
      !logos.logo_light &&
      !logos.mobile_logo_light ? (
        <span
          className={cn(
            'text-foreground inline-block whitespace-nowrap text-xl font-bold',
            className,
          )}
          id="vitnode_logo_text"
        >
          {logos.text}
        </span>
      ) : null}

      {logos.logo_light?.height && logos.logo_light.width && (
        <Image
          alt={logos.text}
          className={cn(
            'w-[--logo-mobile-width] sm:w-[--logo-width]',
            className,
            {
              'dark:hidden': logos.logo_dark,
              'hidden sm:block':
                logos.mobile_logo_light ?? logos.mobile_logo_dark,
            },
          )}
          height={logos.logo_light.height}
          id="vitnode_logo_light"
          sizes="100vw"
          src={`${CONFIG.backend_public_url}/${logos.logo_light.dir_folder}/${logos.logo_light.file_name}`}
          width={logos.logo_light.width}
        />
      )}
      {logos.logo_dark?.height && logos.logo_dark.width && (
        <Image
          alt={logos.text}
          className={cn(
            'w-[--logo-mobile-width] sm:w-[--logo-width]',
            className,
            {
              'hidden dark:block': logos.logo_light,
              'hidden sm:block': !logos.logo_light,
              'dark:hidden dark:sm:block':
                logos.mobile_logo_dark ?? logos.mobile_logo_light,
            },
          )}
          height={logos.logo_dark.height}
          id="vitnode_logo_dark"
          sizes="100vw"
          src={`${CONFIG.backend_public_url}/${logos.logo_dark.dir_folder}/${logos.logo_dark.file_name}`}
          width={logos.logo_dark.width}
        />
      )}

      {logos.mobile_logo_light?.height && logos.mobile_logo_light.width && (
        <Image
          alt={logos.text}
          className={cn(
            'w-[--logo-mobile-width] sm:w-[--logo-width]',
            className,
            {
              'block sm:hidden': logos.logo_light ?? logos.logo_dark,
              'dark:hidden': logos.mobile_logo_dark,
            },
          )}
          height={logos.mobile_logo_light.height}
          id="vitnode_logo_mobile_light"
          sizes="100vw"
          src={`${CONFIG.backend_public_url}/${logos.mobile_logo_light.dir_folder}/${logos.mobile_logo_light.file_name}`}
          width={logos.mobile_logo_light.width}
        />
      )}
      {logos.mobile_logo_dark?.height && logos.mobile_logo_dark.width && (
        <Image
          alt={logos.text}
          className={cn(
            'w-[--logo-mobile-width] sm:w-[--logo-width]',
            className,
            {
              'block sm:hidden dark:block dark:sm:hidden':
                logos.logo_dark ?? logos.logo_light,
              'hidden dark:block': logos.mobile_logo_light,
            },
          )}
          height={logos.mobile_logo_dark.height}
          id="vitnode_logo_mobile_dark"
          sizes="100vw"
          src={`${CONFIG.backend_public_url}/${logos.mobile_logo_dark.dir_folder}/${logos.mobile_logo_dark.file_name}`}
          width={logos.mobile_logo_dark.width}
        />
      )}
    </Link>
  );
};
