// import { Plugin } from '@tiptap/pm/state';
import { mergeAttributes, Node } from '@tiptap/react';
// import { ShowFile } from 'vitnode-shared/files.dto';
// import { StringLanguage } from 'vitnode-shared/string-language.dto';

import { fetcherClient } from '@/api/fetcher-client';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Extension } from '@tiptap/react';
import { ShowFile, UploadFilesBody } from 'vitnode-shared/files.dto';
import { StringLanguage } from 'vitnode-shared/string-language.dto';

import { useEditorState } from '../../hooks/use-editor-state';
import { renderFileNodeForReact } from './client';

// import { renderReactNode } from './client';

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

// declare module '@tiptap/react' {
//   interface Commands<ReturnType> {
//     filesUpload: {
//       uploadFiles: (files: File[]) => ReturnType;
//     };
//   }
// }

// export interface FileStateEditor {
//   data?: Omit<ShowFile, 'count_uses' | 'created_at' | 'secure'>;
//   file?: File;
//   id: number;
// }

// export interface FilesHandlerProps {
//   fileSystem?: {
//     allowUpload: boolean;
//     checkUploadFile: (args: {
//       file: FileStateEditor;
//       fileState: FileStateEditor[];
//     }) => FileStateEditor | undefined;
//     editorValue: string | StringLanguage[];
//     files: FileStateEditor[];
//     handleDelete: (args: {
//       id: number;
//       securityKey: string | undefined;
//     }) => Promise<void>;
//     selectedLanguage: string;
//     uploadFile: (file: FileStateEditor) => Promise<FileStateEditor>;
//   };
// }

// export const FilesHandler = ({ fileSystem }: FilesHandlerProps) =>
//   Node.create<null, { files: FileStateEditor[] }>({
//     name: 'files',
//     group: 'inline',
//     inline: true,
//     atom: true,
//     selectable: true,
//     draggable: true,
//     isolating: false,
//     priority: 10000,

//     addStorage() {
//       return {
//         files: fileSystem?.files ?? [],
//       };
//     },

//     addAttributes() {
//       return {
//         file_name_original: {
//           default: '',
//         },
//         file_name: {
//           default: '',
//         },
//         dir_folder: {
//           default: '',
//         },
//         file_alt: {
//           default: '',
//         },
//         file_size: {
//           default: 0,
//         },
//         mimetype: {
//           default: '',
//         },
//         id: {
//           default: 0,
//         },
//         width: {
//           default: 0,
//         },
//         height: {
//           default: 0,
//         },
//         security_key: {
//           default: '',
//         },
//       };
//     },

//     addNodeView() {
//       return renderReactNode();
//     },

//     renderHTML({ HTMLAttributes }) {
//       return [
//         'button',
//         mergeAttributes(HTMLAttributes, {
//           ['data-type']: 'file',
//           type: 'button',
//         }),
//       ];
//     },

//     addCommands() {
//       return {
//         insertFileIntoContent:
//           id =>
//           ({ commands }) => {
//             const files = this.storage.files.find(file => file.id === id);

//             if (!files) return false;

//             return commands.insertContent({
//               type: this.name,
//               attrs: files.data,
//             });
//           },
//         uploadFiles: files => () => {
//           if (!fileSystem?.editorValue || !files.length) return false;
//           const newFiles: FileStateEditor[] = files.map(file => ({
//             file,
//             isLoading: true,
//             id: Math.floor(Math.random() * 1000) + file.size,
//           }));
//           this.storage.files = [...this.storage.files, ...newFiles];

//           void Promise.all(
//             newFiles
//               .map(async file => {
//                 const findIndex = this.storage.files.findIndex(
//                   item => item.id === file.id,
//                 );
//                 if (findIndex === -1) return;

//                 const fileAfterProcess = fileSystem.checkUploadFile({
//                   file,
//                   fileState: this.storage.files,
//                 });
//                 if (!fileAfterProcess) return;
//                 this.storage.files[findIndex] = fileAfterProcess;
//                 if (fileAfterProcess.error) return;

//                 const fileAfterUpload =
//                   await fileSystem.uploadFile(fileAfterProcess);
//                 this.storage.files[findIndex] = fileAfterUpload;

//                 return fileAfterUpload;
//               })
//               .filter(Boolean) as Promise<FileStateEditor>[],
//           );

//           return true;
//         },
//         deleteFile: id => () => {
//           this.storage.files = this.storage.files.filter(
//             file => file.id !== id,
//           );

//           return true;
//         },
//       };
//     },

//     addProseMirrorPlugins() {
//       const handleUploadFiles = async (
//         files: File[],
//         finishUploadCallback?: (file: FileStateEditor) => void,
//       ): Promise<FileStateEditor[]> => {
//         if (!files.length || !fileSystem?.allowUpload) return [];
//         const newFiles: FileStateEditor[] = files.map(file => ({
//           file,
//           isLoading: true,
//           id: Math.floor(Math.random() * 1000) + file.size,
//         }));

//         this.storage.files = [...this.storage.files, ...newFiles];

//         return (
//           await Promise.all(
//             newFiles.map(async file => {
//               const findIndex = this.storage.files.findIndex(
//                 item => item.id === file.id,
//               );
//               if (findIndex === -1) return;

//               const fileAfterProcess = fileSystem.checkUploadFile({
//                 file,
//                 fileState: this.storage.files,
//               });
//               if (!fileAfterProcess) return;
//               this.storage.files[findIndex] = fileAfterProcess;
//               if (fileAfterProcess.error) return fileAfterProcess;

//               const fileAfterUpload =
//                 await fileSystem.uploadFile(fileAfterProcess);
//               this.storage.files[findIndex] = fileAfterUpload;

//               finishUploadCallback?.(fileAfterUpload);

//               return fileAfterUpload;
//             }),
//           )
//         ).filter(Boolean) as FileStateEditor[];
//       };

//       return [
//         new Plugin({
//           props: {
//             handlePaste(view, event) {
//               const files = [...(event.clipboardData?.files ?? [])];
//               if (!files.length) return false;
//               const { schema } = view.state;

//               void handleUploadFiles(files, file => {
//                 const node = schema.nodes.files.create(file.data);
//                 const transaction = view.state.tr.replaceSelectionWith(node);
//                 view.dispatch(transaction);
//               });

//               return true;
//             },

//             handleDrop(view, event, slice, moved) {
//               const files = [...(event.dataTransfer?.files ?? [])];
//               if (moved && !files.length) return false;

//               void handleUploadFiles(files, file => {
//                 const { schema } = view.state;
//                 const coordinates = view.posAtCoords({
//                   left: event.clientX,
//                   top: event.clientY,
//                 });

//                 if (!coordinates) return;

//                 const node = schema.nodes.files.create(file.data);
//                 const transaction = view.state.tr.insert(coordinates.pos, node);
//                 view.dispatch(transaction);
//               });

//               return true;
//             },
//           },
//         }),
//       ];
//     },
//   });

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
      security_key: {
        default: '',
      },
    };
  },

  addNodeView() {
    return renderFileNodeForReact();
  },
});

export interface FilesHandlerStorage {
  data?: Omit<ShowFile, 'count_uses' | 'created_at' | 'secure'>;
  error?: string;
  file?: File;
  id: number;
  isLoading: boolean;
}

export interface FilesHandlerOptions {
  onRemoveFile?: (id: number) => void;
  onUploadFile?: (file: File) => void;
}

export const FilesHandler = ({
  onUploadFile,
  onRemoveFile,
}: FilesHandlerOptions) => {
  return Extension.create<FilesHandlerOptions>({
    name: 'filesUpload',

    addOptions() {
      return {
        onUploadFile,
        onRemoveFile,
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

              files.forEach(file => {
                this.options.onUploadFile?.(file);
              });

              return true;
            },
            handleDrop: (view, event, slice, moved) => {
              const hasFiles = event.dataTransfer?.files?.length;
              if (!hasFiles || !this.options.onUploadFile) return false;
              event.preventDefault();
              const files = Array.from(event.dataTransfer.files);

              files.forEach(file => {
                this.options.onUploadFile?.(file);
              });

              // Get the drop position
              const coords = { left: event.clientX, top: event.clientY };
              const pos = view.posAtCoords(coords);
              if (!pos) return false;

              return true;
            },
          },
        }),
      ];
    },
  });
};
