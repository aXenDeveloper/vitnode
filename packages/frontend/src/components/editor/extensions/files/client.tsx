'use client';

import { formatBytes } from '@/helpers/format-bytes';
import {
  NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react';
import { File } from 'lucide-react';
import Image from 'next/image';
import React from 'react';
import Moveable from 'react-moveable';

import { CONFIG } from '../../../../helpers/config-with-env';
import { acceptMimeTypeImage, FilesHandlerAttributes } from './files';

const FileComponent = ({
  node: { attrs },
  selected,
  updateAttributes,
}: NodeViewProps) => {
  const targetRef = React.useRef<HTMLDivElement>(null);
  const data = attrs as FilesHandlerAttributes;

  if (
    acceptMimeTypeImage.includes(data.mimetype) &&
    data.width &&
    data.height
  ) {
    return (
      <NodeViewWrapper
        className="relative inline-block"
        data-drag-handle=""
        draggable
      >
        <div
          className="relative"
          ref={targetRef}
          style={{
            width: data.width,
            height: data.height,
          }}
        >
          <Image
            alt={data.file_alt ?? data.file_name_original}
            className="h-auto w-full"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            src={`${CONFIG.backend_public_url}/${data.dir_folder}/${data.file_name}`}
          />
        </div>
        {selected && (
          <Moveable
            container={null}
            edge={false}
            keepRatio={true}
            onResize={({
              target,
              width,
              height,

              delta,
            }) => {
              if (delta[0]) target.style.width = `${width}px`;
              if (delta[1]) target.style.height = `${height}px`;
            }}
            onResizeEnd={e => {
              updateAttributes({
                width: Math.round(+e.lastEvent.width),
                height: Math.round(+e.lastEvent.height),
              });
            }}
            onScale={({ target, transform }) => {
              target.style.transform = transform;
            }}
            origin={false}
            resizable={true}
            scalable={true}
            target={targetRef}
            throttleDrag={0}
            throttleResize={0}
            throttleScale={0}
          />
        )}
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
