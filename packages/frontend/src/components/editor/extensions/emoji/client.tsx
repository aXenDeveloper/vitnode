'use client';

import { Emoji } from '@emoji-mart/data';
import { ReactRenderer } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import tippy, { Instance } from 'tippy.js';

import { cn } from '../../../../helpers/classnames';
import { CONFIG } from '../../../../helpers/config-with-env';
import { Button } from '../../../ui/button';
import { classPopover } from '../../../ui/popover';
import {
  ComponentListRef,
  SuggestionKeyDownProps,
  SuggestionProps,
} from '../mentions/client';

const ComponentList = ({
  command,
  items,
  ref,
}: {
  command: (_props: { id: string }) => void;
  items: Emoji[];
  ref: React.RefCallback<ComponentListRef>;
}) => {
  const t = useTranslations('core.global');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const skinToneIndexLocalStorage = localStorage.getItem(
    CONFIG.local_storage.editor_skin_tone,
  );
  const skinToneIndex = skinToneIndexLocalStorage
    ? +skinToneIndexLocalStorage
    : 0;

  const selectItem = (index: number) => {
    const emoji = items[index];
    const icon =
      emoji.skins.length > skinToneIndex
        ? emoji.skins[skinToneIndex].native
        : emoji.skins[0].native;

    command({ id: icon });
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + items.length - 1) % items.length);
  };
  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % items.length);
  };
  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  React.useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        upHandler();

        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();

        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();

        return true;
      }

      return false;
    },
  }));

  return (
    <>
      {items.length ? (
        items.map((emoji, index) => {
          const icon =
            emoji.skins.length > skinToneIndex
              ? emoji.skins[skinToneIndex].native
              : emoji.skins[0].native;

          return (
            <Button
              className={cn('justify-start', {
                'bg-accent': index === selectedIndex,
              })}
              key={index}
              onClick={() => {
                selectItem(index);
              }}
              size="sm"
              variant="ghost"
            >
              <span>{icon}</span> {emoji.id}
            </Button>
          );
        })
      ) : (
        <div className="text-muted-foreground italic">{t('no_results')}</div>
      )}
    </>
  );
};

let component: null | ReactRenderer<ComponentListRef> = null;
let popup: Instance[] | null = null;

export function onStart<T>(props: SuggestionProps<T>) {
  component = new ReactRenderer(ComponentList, {
    props,
    editor: props.editor,
    className: cn(classPopover, 'flex flex-col p-2'),
  });

  if (!props.clientRect) {
    return;
  }

  popup = tippy('body', {
    getReferenceClientRect: props.clientRect,
    appendTo: () => document.body,
    content: component.element,
    showOnCreate: true,
    interactive: true,
    trigger: 'manual',
    placement: 'bottom-start',
  });
}

export function onUpdate<T>(props: SuggestionProps<T>) {
  if (!component || !popup) {
    return;
  }

  component.updateProps(props);

  if (!props.clientRect) {
    return;
  }

  popup[0].setProps({
    getReferenceClientRect: props.clientRect,
  });
}

export function onKeyDown(props: SuggestionKeyDownProps) {
  if (!component || !popup) {
    return;
  }

  if (props.event.key === 'Escape') {
    popup[0].hide();

    return true;
  }

  return component.ref?.onKeyDown(props);
}

export const onExit = () => {
  if (!component || !popup) {
    return;
  }

  popup[0].destroy();
  component.destroy();
};
