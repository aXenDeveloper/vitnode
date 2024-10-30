import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ChevronDownIcon,
} from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '../../../ui/popover';
import { useEditorState } from '../../hooks/use-editor-state';
import { ButtonToolbarEditor } from '../button';
import { ToggleToolbarEditor } from '../toggle';

export const TextAlignToolbarEditor = () => {
  const { editor } = useEditorState();

  const getCurrentIcon = () => {
    if (editor.isActive({ textAlign: 'center' })) {
      return <AlignCenter />;
    } else if (editor.isActive({ textAlign: 'right' })) {
      return <AlignRight />;
    } else if (editor.isActive({ textAlign: 'justify' })) {
      return <AlignJustify />;
    }

    return <AlignLeft />;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <ButtonToolbarEditor
          className="h-9 w-14 justify-center gap-1 p-0 [&>svg:last-child]:size-4 [&>svg:not(:last-child)]:size-5"
          name="align"
        >
          {getCurrentIcon()}
          <ChevronDownIcon className="opacity-50" />
        </ButtonToolbarEditor>
      </PopoverTrigger>

      <PopoverContent className="flex w-fit max-w-80 flex-wrap gap-1 p-2">
        <ToggleToolbarEditor
          onPressedChange={() => {
            editor.commands.setTextAlign('left');
            editor.commands.focus();
          }}
          pressed={editor.isActive({ textAlign: 'left' })}
        >
          <AlignLeft />
        </ToggleToolbarEditor>

        <ToggleToolbarEditor
          onPressedChange={() => {
            editor.commands.setTextAlign('center');
            editor.commands.focus();
          }}
          pressed={editor.isActive({ textAlign: 'center' })}
        >
          <AlignCenter />
        </ToggleToolbarEditor>

        <ToggleToolbarEditor
          onPressedChange={() => {
            editor.commands.setTextAlign('right');
            editor.commands.focus();
          }}
          pressed={editor.isActive({ textAlign: 'right' })}
        >
          <AlignRight />
        </ToggleToolbarEditor>

        <ToggleToolbarEditor
          onPressedChange={() => {
            editor.commands.setTextAlign('justify');
            editor.commands.focus();
          }}
          pressed={editor.isActive({ textAlign: 'justify' })}
        >
          <AlignJustify />
        </ToggleToolbarEditor>
      </PopoverContent>
    </Popover>
  );
};
