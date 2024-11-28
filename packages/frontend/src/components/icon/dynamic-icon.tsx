import { cn } from '@/helpers/classnames';
import { icons, type LucideProps } from 'lucide-react';

type IconComponentName = keyof typeof icons;

const isValidIconComponent = (
  componentName: string,
): componentName is IconComponentName => {
  return componentName in icons;
};

export const DynamicIcon = ({
  name,
  className,
  ...props
}: LucideProps & {
  name: string;
}) => {
  if (/\p{Extended_Pictographic}/gu.test(name)) {
    return (
      <span className={cn('text-center leading-none', className)}>{name}</span>
    );
  }

  const kebabToPascal = (str: string) =>
    str
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');

  const componentName = kebabToPascal(name);

  if (!isValidIconComponent(componentName)) {
    return null;
  }

  const Icon = icons[componentName];

  return <Icon className={className} {...props} />;
};
