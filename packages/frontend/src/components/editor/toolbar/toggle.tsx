import React from 'react';
import { Toggle } from 'vitnode-frontend/components/ui/toggle';

export const ToggleToolbarEditor = ({
  children,
  disabled,
  onPressedChange,
  pressed,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onPressedChange: () => void;
  pressed: boolean;
}) => {
  return (
    <Toggle
      disabled={disabled}
      onPressedChange={onPressedChange}
      pressed={pressed}
      size="sm"
    >
      {children}
    </Toggle>
  );
};
