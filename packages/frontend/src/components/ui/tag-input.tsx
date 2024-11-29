'use client';

import { X } from 'lucide-react';
import React from 'react';

import { badgeVariants } from './badge';
import { Input } from './input';

interface MultiProps extends Props {
  multiple?: true;
  value?: TagInputItemProps[] | undefined;
}

interface Props
  extends Omit<React.HTMLAttributes<HTMLInputElement>, 'onChange'> {
  className?: string;
  disabled?: boolean;
  onChange: (value?: TagInputItemProps | TagInputItemProps[]) => void;
}

interface SingleProps extends Props {
  multiple?: never;
  value?: TagInputItemProps | undefined;
}

export interface TagInputItemProps {
  id: number | string;
  value: string;
}

export const TagInput = ({
  multiple,
  onChange,
  value: valueFromProps,
  disabled,
  ...rest
}: MultiProps | SingleProps) => {
  const values: TagInputItemProps[] = Array.isArray(valueFromProps)
    ? valueFromProps
    : valueFromProps
      ? [valueFromProps]
      : [];
  const [textInput, setTextInput] = React.useState('');

  return (
    <div className="space-y-3">
      {values.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {values.map(item => {
            const onRemove = () => {
              if (multiple) {
                onChange(values.filter(value => value.id !== item.id));

                return;
              }

              onChange();
            };

            return (
              <div
                className={badgeVariants({
                  variant: 'outline',
                  className: 'shrink-0 cursor-pointer [&>svg]:size-4',
                })}
                key={item.id}
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                  onRemove();
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    e.preventDefault();
                    onRemove();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                {item.value} <X />
              </div>
            );
          })}
        </div>
      )}

      {((!multiple && values.length <= 0) || multiple) && (
        <Input
          disabled={(!multiple && values.length > 0) || disabled}
          onChange={e => {
            setTextInput(e.target.value);
          }}
          onKeyDown={e => {
            if ((e.key === 'Enter' || e.key === ',') && textInput) {
              e.preventDefault();
              const items = textInput.split(',').map(value => value.trim());

              onChange([
                ...values,
                ...items.map(value => ({
                  id: Math.random() * 1000,
                  value,
                })),
              ]);
              setTextInput('');
            }
          }}
          value={textInput}
          {...rest}
          type="text"
        />
      )}
    </div>
  );
};
