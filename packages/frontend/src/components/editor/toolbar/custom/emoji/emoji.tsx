import { Loader } from '@/components/ui/loader';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ChevronDownIcon, SmileIcon } from 'lucide-react';
import React from 'react';

import { useEditorState } from '../../../hooks/use-editor-state';
import { ButtonToolbarEditor } from '../../button';

const Content = React.lazy(async () =>
  import('./content').then(module => ({
    default: module.ContentEmojiToolbarEditor,
  })),
);

export const EmojiToolbarEditor = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const { editor } = useEditorState();

  return (
    <Popover modal onOpenChange={setIsOpen} open={isOpen}>
      <PopoverTrigger asChild>
        <ButtonToolbarEditor
          className="w-14 justify-center gap-1 p-0 [&>svg:last-child]:size-4 [&>svg:not(:last-child)]:size-5"
          name="emoji.title"
        >
          <SmileIcon />
          <ChevronDownIcon className="opacity-50" />
        </ButtonToolbarEditor>
      </PopoverTrigger>

      <PopoverContent
        className="w-72 p-0"
        onCloseAutoFocus={() => editor.commands.focus()}
      >
        <React.Suspense fallback={<Loader className="p-2" />}>
          <Content setIsOpen={setIsOpen} />
        </React.Suspense>
      </PopoverContent>
    </Popover>
  );
};
