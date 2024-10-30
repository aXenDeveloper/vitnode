import { Loader } from '@/components/ui/loader';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { LinkIcon } from 'lucide-react';
import React from 'react';

import { useEditorState } from '../../../hooks/use-editor-state';
import { ButtonToolbarEditor } from '../../button';

const Content = React.lazy(async () =>
  import('./content').then(module => ({
    default: module.ContentLinkToolbarEditor,
  })),
);

export const LinkToolbarEditor = () => {
  const [open, setOpen] = React.useState(false);
  const { editor } = useEditorState();

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <ButtonToolbarEditor active={editor.isActive('link')} name="link.title">
          <LinkIcon />
        </ButtonToolbarEditor>
      </PopoverTrigger>

      <PopoverContent
        className="w-80"
        onCloseAutoFocus={() => editor.commands.focus()}
      >
        <React.Suspense fallback={<Loader />}>
          <Content setOpen={setOpen} />
        </React.Suspense>
      </PopoverContent>
    </Popover>
  );
};
