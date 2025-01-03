'use client';

import React from 'react';
import { TagInput } from 'vitnode-frontend/components/ui/tag-input';

interface TagInputItemProps {
  id: number | string;
  value: string;
}

export const TagInputDemo = () => {
  const [value, onChange] = React.useState<TagInputItemProps[]>([]);

  const handleChange = (newValue?: TagInputItemProps | TagInputItemProps[]) => {
    if (Array.isArray(newValue)) {
      onChange(newValue.map(item => ({ id: item.id, value: item.value })));
    } else if (newValue) {
      onChange([{ id: newValue.id, value: newValue.value }]);
    } else {
      onChange([]);
    }
  };

  return <TagInput multiple onChange={handleChange} value={value} />;
};
