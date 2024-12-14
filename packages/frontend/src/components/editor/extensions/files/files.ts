import { Plugin, PluginKey } from '@tiptap/pm/state';
import { mergeAttributes, Node } from '@tiptap/react';
import { Extension } from '@tiptap/react';
import { ShowFile } from 'vitnode-shared/files.dto';

import { renderFileNodeForReact } from './client';

export interface FilesHandlerAttributes {
  dir_folder: string;
  file_alt?: string;
  file_name: string;
  file_name_original: string;
  file_size: number;
  height?: number;
  id: number;
  mimetype: string;
  width?: number;
}

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    filesUpload: {
      insertFileIntoContent: (
        file: Omit<ShowFile, 'count_uses' | 'created_at' | 'secure'>,
      ) => ReturnType;
    };
  }
}

const FileNode = Node.create({
  name: 'fileNode',
  group: 'inline',
  inline: true,
  draggable: true,
  atom: true,

  addAttributes() {
    return {
      file_name_original: {
        default: '',
      },
      file_name: {
        default: '',
      },
      dir_folder: {
        default: '',
      },
      file_alt: {
        default: '',
      },
      file_size: {
        default: 0,
      },
      mimetype: {
        default: '',
      },
      id: {
        default: 0,
      },
      width: {
        default: 0,
      },
      height: {
        default: 0,
      },
    };
  },

  addCommands() {
    return {
      insertFileIntoContent:
        file =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: file,
          });
        },
    };
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'button',
      mergeAttributes(HTMLAttributes, {
        ['data-type']: this.name,
        type: 'button',
      }),
    ];
  },

  addNodeView() {
    return renderFileNodeForReact();
  },
});

export interface FilesHandlerOptions {
  onUploadFile?: (file: File) => Promise<ShowFile | undefined>;
}

export interface FilesHandlerStorage {
  data?: Omit<ShowFile, 'count_uses' | 'created_at'>;
  error?: string;
  file?: File;
  id: number;
  isLoading: boolean;
}

export const FilesHandler = ({ onUploadFile }: FilesHandlerOptions) => {
  return Extension.create<FilesHandlerOptions>({
    name: 'filesUpload',

    addOptions() {
      return {
        onUploadFile,
      };
    },

    addNodeView() {
      return {
        fileNode: FileNode,
      };
    },

    addExtensions() {
      return [FileNode];
    },

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey('fileUpload'),
          props: {
            handlePaste: (view, event) => {
              const hasFiles = event.clipboardData?.files?.length;
              if (!hasFiles || !this.options.onUploadFile) return false;
              event.preventDefault();
              const files = Array.from(event.clipboardData.files);

              void Promise.all(
                files.map(async file => {
                  const fileData = await this.options.onUploadFile?.(file);
                  if (!fileData) return;

                  const { schema } = view.state;
                  const fileNodeType = schema.nodes.fileNode;
                  if (!fileNodeType) return;

                  const node = fileNodeType.create({
                    file_name_original: fileData.file_name_original,
                    file_name: fileData.file_name,
                    dir_folder: fileData.dir_folder,
                    file_alt: fileData.file_alt,
                    file_size: fileData.file_size,
                    mimetype: fileData.mimetype,
                    id: fileData.id,
                    width: fileData.width,
                    height: fileData.height,
                  });

                  // Use the current selection position for paste
                  const { from, to } = view.state.selection;
                  const transaction = view.state.tr.replaceRangeWith(
                    from,
                    to,
                    node,
                  );
                  view.dispatch(transaction);
                }),
              );

              return true;
            },
            handleDrop: (view, event) => {
              const hasFiles = event.dataTransfer?.files?.length;
              if (!hasFiles || !this.options.onUploadFile) return false;
              event.preventDefault();
              const files = Array.from(event.dataTransfer.files);

              // Get the drop position
              const coords = { left: event.clientX, top: event.clientY };
              const pos = view.posAtCoords(coords);
              if (!pos) return false;

              void Promise.all(
                files.map(async file => {
                  const fileData = await this.options.onUploadFile?.(file);
                  if (!fileData) return;

                  const { schema } = view.state;
                  const fileNodeType = schema.nodes.fileNode;
                  if (!fileNodeType) return;
                  const node = fileNodeType.create({
                    file_name_original: fileData.file_name_original,
                    file_name: fileData.file_name,
                    dir_folder: fileData.dir_folder,
                    file_alt: fileData.file_alt,
                    file_size: fileData.file_size,
                    mimetype: fileData.mimetype,
                    id: fileData.id,
                    width: fileData.width,
                    height: fileData.height,
                  });

                  // Insert the file node at the drop position
                  const transaction = view.state.tr.insert(pos.pos, node);
                  view.dispatch(transaction);
                }),
              );

              return true;
            },
          },
        }),
      ];
    },
  });
};
