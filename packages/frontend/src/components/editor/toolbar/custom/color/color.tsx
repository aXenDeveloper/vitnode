import { ColorPicker } from '@/components/ui/color-picker';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getHSLFromString } from '@/helpers/colors';
import { Baseline, ChevronDownIcon } from 'lucide-react';
import React from 'react';

import { useEditorState } from '../../../hooks/use-editor-state';
import { ButtonToolbarEditor } from '../../button';

export const ColorToolbarEditor = () => {
  const [open, setOpen] = React.useState(false);
  const { editor } = useEditorState();
  const colorFromEditor: string = editor.getAttributes('textStyle').color;
  const hslColor = getHSLFromString(colorFromEditor);

  return (
    <Popover modal onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <ButtonToolbarEditor
          className="w-14 justify-center gap-1 p-0 [&>svg:last-child]:size-4 [&>svg:not(:last-child)]:size-5"
          name="color_text"
          style={{
            backgroundColor: hslColor
              ? `hsl(${hslColor.h} ${hslColor.s}% ${hslColor.l}% / 10%)`
              : undefined,
            color: hslColor
              ? `hsl(${hslColor.h} ${hslColor.s}% ${hslColor.l}%)`
              : undefined,
          }}
        >
          <Baseline />
          <ChevronDownIcon className="opacity-50" />
        </ButtonToolbarEditor>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-2">
        <ColorPicker
          clearOnClick={() => {
            setOpen(false);
          }}
          onChange={value => {
            if (value) {
              editor.commands.setColor(value);

              return;
            }

            editor.commands.unsetColor();
          }}
          value={colorFromEditor}
        />
      </PopoverContent>
    </Popover>
  );
};
