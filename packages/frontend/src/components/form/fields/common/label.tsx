import { FormLabel } from '@/components/ui/form';
import { cn } from '@/helpers/classnames';

export const AutoFormLabel = ({
  label,
  isRequired,
  className,
  theme,
  description,
  hideOptionalLabel,
}: {
  className?: string;
  description: React.ReactNode | undefined;
  hideOptionalLabel: boolean | undefined;
  isRequired: boolean;
  label: React.ReactNode | string;
  theme: 'horizontal' | 'vertical';
}) => {
  return (
    <FormLabel
      className={cn(className, {
        '@xs:w-32 @xs:shrink-0 @xs:text-right @sm:w-40 @xl:w-72 @3xl:w-96 @4xl:w-[26rem] @sm:items-end flex w-full flex-col gap-1':
          theme === 'horizontal',
        '@xs:mt-3': !description,
      })}
      optional={!isRequired && !hideOptionalLabel}
    >
      {description && theme === 'horizontal' ? (
        <>
          <span>{label}</span>
          <span
            className={cn(
              'text-muted-foreground @sm:items-end mt-1 flex max-w-sm flex-col gap-2 text-sm font-normal',
            )}
          >
            {description}
          </span>
        </>
      ) : (
        label
      )}
    </FormLabel>
  );
};
