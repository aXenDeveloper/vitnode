'use client';

import { ReactNodeViewRenderer } from '@tiptap/react';

import { CodeBlockComponent } from './code-block-component';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
// TODO: Fix this
export const renderReactNode = () => ReactNodeViewRenderer(CodeBlockComponent);
