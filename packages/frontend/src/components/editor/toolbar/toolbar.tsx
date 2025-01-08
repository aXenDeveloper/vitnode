import { useMiddlewareData } from '@/hooks/use-middleware-data';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  RemoveFormatting,
  Strikethrough,
  Underline,
} from 'lucide-react';

import { cn } from '../../../helpers/classnames';
import { useEditorState } from '../hooks/use-editor-state';
import { ButtonToolbarEditor } from './button';
import { ColorToolbarEditor } from './custom/color/color';
import { EmojiToolbarEditor } from './custom/emoji/emoji';
import { HeadingToolbarEditor } from './custom/heading';
import { LinkToolbarEditor } from './custom/link/link';
import { TextAlignToolbarEditor } from './custom/text-align';
import { UploadFilesToolbarEditor } from './custom/upload-files';
import { ToggleToolbarEditor } from './toggle';

export const ToolBarEditor = () => {
  const middleware = useMiddlewareData();
  const { editor } = useEditorState();

  return (
    <div
      className={cn(
        'bg-background flex flex-wrap items-center gap-1 rounded-t-sm border-b p-1',
        {
          'sticky top-0 z-10 max-h-[26vh] overflow-auto':
            middleware.editor.sticky,
        },
      )}
    >
      <ButtonToolbarEditor
        name="remove_formatting"
        onClick={() =>
          editor.chain().focus().clearNodes().unsetAllMarks().run()
        }
      >
        <RemoveFormatting />
      </ButtonToolbarEditor>

      <HeadingToolbarEditor />

      <ToggleToolbarEditor
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        pressed={editor.isActive('bold')}
      >
        <Bold />
      </ToggleToolbarEditor>

      <ToggleToolbarEditor
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        pressed={editor.isActive('italic')}
      >
        <Italic />
      </ToggleToolbarEditor>

      <ToggleToolbarEditor
        onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
        pressed={editor.isActive('underline')}
      >
        <Underline />
      </ToggleToolbarEditor>

      <ToggleToolbarEditor
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        pressed={editor.isActive('strike')}
      >
        <Strikethrough />
      </ToggleToolbarEditor>

      <ToggleToolbarEditor
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        pressed={editor.isActive('bulletList')}
      >
        <List />
      </ToggleToolbarEditor>

      <ToggleToolbarEditor
        onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        pressed={editor.isActive('orderedList')}
      >
        <ListOrdered />
      </ToggleToolbarEditor>

      <ColorToolbarEditor />
      <TextAlignToolbarEditor />
      <LinkToolbarEditor />
      <EmojiToolbarEditor />
      <UploadFilesToolbarEditor />

      <ButtonToolbarEditor
        name="horizontal_rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus />
      </ButtonToolbarEditor>

      <ToggleToolbarEditor
        onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
        pressed={editor.isActive('blockquote')}
      >
        <Quote />
      </ToggleToolbarEditor>
    </div>
  );
};
