import { getMiddlewareData } from '@/api/get-middleware-data';
import { cn } from '@/helpers/classnames';
import { CONFIG } from '@/helpers/config-with-env';
import { Link } from '@/navigation';
import Image from 'next/image';

export const LogoHeader = async ({ className }: { className?: string }) => {
  const { logos } = await getMiddlewareData();

  return (
    <Link
      href="/"
      id="vitnode_logo"
      style={
        {
          '--logo-width': `${logos.width}rem`,
          '--logo-mobile-width': `${logos.mobile_width}rem`,
        } as React.CSSProperties
      }
    >
      {!logos.dark &&
      !logos.mobile_dark &&
      !logos.light &&
      !logos.mobile_light ? (
        <span
          className={cn(
            'text-foreground inline-block whitespace-nowrap font-bold',
            className,
          )}
          id="vitnode_logo_text"
        >
          {logos.text}
        </span>
      ) : null}

      {logos.light?.height && logos.light.width && (
        <Image
          alt={logos.text}
          className={cn(
            'w-[--logo-mobile-width] sm:w-[--logo-width]',
            className,
            {
              'dark:hidden': logos.dark,
              'hidden sm:block': logos.mobile_light ?? logos.mobile_dark,
            },
          )}
          height={logos.light.height}
          id="vitnode_logo_light"
          sizes="100vw"
          src={`${CONFIG.backend_public_url}/${logos.light.dir_folder}/${logos.light.file_name}`}
          width={logos.light.width}
        />
      )}
      {logos.dark?.height && logos.dark.width && (
        <Image
          alt={logos.text}
          className={cn(
            'w-[--logo-mobile-width] sm:w-[--logo-width]',
            className,
            {
              'hidden dark:block': logos.light,
              'hidden sm:block': !logos.light,
              'dark:hidden dark:sm:block':
                logos.mobile_dark ?? logos.mobile_light,
            },
          )}
          height={logos.dark.height}
          id="vitnode_logo_dark"
          sizes="100vw"
          src={`${CONFIG.backend_public_url}/${logos.dark.dir_folder}/${logos.dark.file_name}`}
          width={logos.dark.width}
        />
      )}

      {logos.mobile_light?.height && logos.mobile_light.width && (
        <Image
          alt={logos.text}
          className={cn(
            'w-[--logo-mobile-width] sm:w-[--logo-width]',
            className,
            {
              'block sm:hidden': logos.light ?? logos.dark,
              'dark:hidden': logos.mobile_dark,
            },
          )}
          height={logos.mobile_light.height}
          id="vitnode_logo_mobile_light"
          sizes="100vw"
          src={`${CONFIG.backend_public_url}/${logos.mobile_light.dir_folder}/${logos.mobile_light.file_name}`}
          width={logos.mobile_light.width}
        />
      )}
      {logos.mobile_dark?.height && logos.mobile_dark.width && (
        <Image
          alt={logos.text}
          className={cn(
            'w-[--logo-mobile-width] sm:w-[--logo-width]',
            className,
            {
              'block sm:hidden dark:block dark:sm:hidden':
                logos.dark ?? logos.light,
              'hidden dark:block': logos.mobile_light,
            },
          )}
          height={logos.mobile_dark.height}
          id="vitnode_logo_mobile_dark"
          sizes="100vw"
          src={`${CONFIG.backend_public_url}/${logos.mobile_dark.dir_folder}/${logos.mobile_dark.file_name}`}
          width={logos.mobile_dark.width}
        />
      )}
    </Link>
  );
};
