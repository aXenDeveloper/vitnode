'use client';

import { formatBytes } from '@/helpers/format-bytes';
import {
  NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react';
import { File } from 'lucide-react';
import Image from 'next/image';

import { CONFIG } from '../../../../helpers/config-with-env';
import { acceptMimeTypeImage, FilesHandlerAttributes } from './files';

const FileComponent = ({ node: { attrs } }: NodeViewProps) => {
  const data = attrs as FilesHandlerAttributes;

  if (
    acceptMimeTypeImage.includes(data.mimetype) &&
    data.width &&
    data.height
  ) {
    return (
      <NodeViewWrapper className="inline-block">
        <div data-drag-handle="" draggable>
          <Image
            alt={data.file_alt ?? data.file_name_original}
            className="h-auto w-full"
            height={data.height}
            sizes="100vw"
            src={`${CONFIG.backend_public_url}/${data.dir_folder}/${data.file_name}`}
            width={data.width}
          />
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="inline-block" data-drag-handle="" draggable>
      <button
        className="cursor-gap bg-muted hover:bg-accent rounded-md text-left text-sm font-medium transition-colors"
        tabIndex={-1}
        type="button"
      >
        <div className="flex items-center gap-5 px-5 py-2">
          <File className="text-muted-foreground size-7" />
          <div className="pointer-events-none select-none">
            <span className="block max-w-80 truncate leading-tight">
              {data.file_name_original}
            </span>
            <div className="text-muted-foreground space-x-2 text-sm">
              <span>{formatBytes(data.file_size)}</span>
              <span>&middot;</span>
              <span>{data.mimetype}</span>
            </div>
          </div>
        </div>
      </button>
    </NodeViewWrapper>
  );
};

export const renderFileNodeForReact = () =>
  ReactNodeViewRenderer(FileComponent);
