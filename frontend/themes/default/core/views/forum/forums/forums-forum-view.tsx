'use client';

import { Components, Virtuoso } from 'react-virtuoso';
import { forwardRef } from 'react';

import { CategoryForum } from './item';

export const ForumsForumView = () => {
  const List: Components['List'] = forwardRef((props, ref) => {
    return <div className="flex flex-col gap-4" {...props} ref={ref} />;
  });

  List.displayName = 'List';

  return (
    <Virtuoso
      totalCount={200}
      useWindowScroll
      components={{
        List
      }}
      itemContent={index => <CategoryForum index={index} />}
    />
  );
};
