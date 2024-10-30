import { Core_Editor_Files__UploadMutation } from '@/graphql/mutations/editor/core_editor_files__upload.generated';
import { StringLanguage } from '@/graphql/types';
import { Plugin } from '@tiptap/pm/state';
import { mergeAttributes, Node } from '@tiptap/react';

import { renderReactNode } from './client';

export const acceptMimeTypeImage = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
];

export const acceptMimeTypeVideo = ['video/mp4', 'video/webm', 'video/ogg'];

export interface FilesHandlerAttributes {
  dir_folder: string;
  file_alt?: string;
  file_name: string;
  file_name_original: string;
  file_size: number;
  height?: number;
  id: number;
  mimetype: string;
  security_key?: string;
  width?: number;
}

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    files: {
      deleteFile: (id: number) => ReturnType;
      insertFileIntoContent: (id: number) => ReturnType;
      uploadFiles: (file: File[]) => ReturnType;
    };
  }
}

export interface FileStateEditor {
  data?: Core_Editor_Files__UploadMutation['core_editor_files__upload'];
  error?: string;
  file?: File;
  id: number;
  isLoading: boolean;
}

export interface FilesHandlerProps {
  fileSystem?: {
    allowUpload: boolean;
    checkUploadFile: (args: {
      file: FileStateEditor;
      fileState: FileStateEditor[];
    }) => FileStateEditor | undefined;
    editorValue: string | StringLanguage[];
    files: FileStateEditor[];
    handleDelete: (args: {
      id: number;
      securityKey: string | undefined;
    }) => Promise<void>;
    selectedLanguage: string;
    uploadFile: (file: FileStateEditor) => Promise<FileStateEditor>;
  };
}

export const FilesHandler = ({ fileSystem }: FilesHandlerProps) =>
  Node.create<null, { files: FileStateEditor[] }>({
    name: 'files',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    draggable: true,
    isolating: false,
    priority: 10000,

    addStorage() {
      return {
        files: fileSystem?.files ?? [],
      };
    },

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
        security_key: {
          default: '',
        },
      };
    },

    addNodeView() {
      return renderReactNode();
    },

    renderHTML({ HTMLAttributes }) {
      return [
        'button',
        mergeAttributes(HTMLAttributes, {
          ['data-type']: 'file',
          type: 'button',
        }),
      ];
    },

    addCommands() {
      return {
        insertFileIntoContent:
          id =>
          ({ commands }) => {
            const files = this.storage.files.find(file => file.id === id);

            if (!files) return false;

            return commands.insertContent({
              type: this.name,
              attrs: files.data,
            });
          },
        uploadFiles: files => () => {
          if (!fileSystem?.editorValue || !files.length) return false;
          const newFiles: FileStateEditor[] = files.map(file => ({
            file,
            isLoading: true,
            id: Math.floor(Math.random() * 1000) + file.size,
          }));
          this.storage.files = [...this.storage.files, ...newFiles];

          void Promise.all(
            newFiles
              .map(async file => {
                const findIndex = this.storage.files.findIndex(
                  item => item.id === file.id,
                );
                if (findIndex === -1) return;

                const fileAfterProcess = fileSystem.checkUploadFile({
                  file,
                  fileState: this.storage.files,
                });
                if (!fileAfterProcess) return;
                this.storage.files[findIndex] = fileAfterProcess;
                if (fileAfterProcess.error) return;

                const fileAfterUpload =
                  await fileSystem.uploadFile(fileAfterProcess);
                this.storage.files[findIndex] = fileAfterUpload;

                return fileAfterUpload;
              })
              .filter(Boolean) as Promise<FileStateEditor>[],
          );

          return true;
        },
        deleteFile: id => () => {
          this.storage.files = this.storage.files.filter(
            file => file.id !== id,
          );

          return true;
        },
      };
    },

    addProseMirrorPlugins() {
      const handleUploadFiles = async (
        files: File[],
        finishUploadCallback?: (file: FileStateEditor) => void,
      ): Promise<FileStateEditor[]> => {
        if (!files.length || !fileSystem?.allowUpload) return [];
        const newFiles: FileStateEditor[] = files.map(file => ({
          file,
          isLoading: true,
          id: Math.floor(Math.random() * 1000) + file.size,
        }));

        this.storage.files = [...this.storage.files, ...newFiles];

        return (
          await Promise.all(
            newFiles.map(async file => {
              const findIndex = this.storage.files.findIndex(
                item => item.id === file.id,
              );
              if (findIndex === -1) return;

              const fileAfterProcess = fileSystem.checkUploadFile({
                file,
                fileState: this.storage.files,
              });
              if (!fileAfterProcess) return;
              this.storage.files[findIndex] = fileAfterProcess;
              if (fileAfterProcess.error) return fileAfterProcess;

              const fileAfterUpload =
                await fileSystem.uploadFile(fileAfterProcess);
              this.storage.files[findIndex] = fileAfterUpload;

              finishUploadCallback?.(fileAfterUpload);

              return fileAfterUpload;
            }),
          )
        ).filter(Boolean) as FileStateEditor[];
      };

      return [
        new Plugin({
          props: {
            handlePaste(view, event) {
              const files = [...(event.clipboardData?.files ?? [])];
              if (!files.length) return false;
              const { schema } = view.state;

              void handleUploadFiles(files, file => {
                const node = schema.nodes.files.create(file.data);
                const transaction = view.state.tr.replaceSelectionWith(node);
                view.dispatch(transaction);
              });

              return true;
            },

            handleDrop(view, event, slice, moved) {
              const files = [...(event.dataTransfer?.files ?? [])];
              if (moved && !files.length) return false;

              void handleUploadFiles(files, file => {
                const { schema } = view.state;
                const coordinates = view.posAtCoords({
                  left: event.clientX,
                  top: event.clientY,
                });

                if (!coordinates) return;

                const node = schema.nodes.files.create(file.data);
                const transaction = view.state.tr.insert(coordinates.pos, node);
                view.dispatch(transaction);
              });

              return true;
            },
          },
        }),
      ];
    },
  });
